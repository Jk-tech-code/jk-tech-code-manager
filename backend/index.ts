import { router, json, error, db, requireAuth } from '@appdeploy/sdk';

type RecordBody = Record<string, unknown>;
type RecordKind = 'clients' | 'projects' | 'invoices';

const safe = (value: string) => value.replace(/[^A-Za-z0-9_.-]/g, '_');
const tableFor = (kind: RecordKind, userId: string) => kind + '_' + safe(userId);
const isObject = (value: unknown): value is RecordBody =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const numberValue = (value: unknown) =>
  typeof value === 'number' ? value : Number(value);
const validDate = (value: unknown) => {
  if (value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

// Parse KES decimal input as integer minor units without float arithmetic.
const toMinorUnits = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor <= 100_000_000_000_000
    ? minor
    : null;
};

const legacyMinorUnits = (minor: unknown, amount: unknown): number => {
  if (typeof minor === 'number' && Number.isSafeInteger(minor) && minor >= 0)
    return minor;
  // Older releases allowed more than two decimal places. Preserve their value
  // to the nearest KES cent rather than displaying zero for a legacy record.
  if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
    const rounded = Math.round(amount * 100);
    return Number.isSafeInteger(rounded) ? rounded : 0;
  }
  return toMinorUnits(amount) ?? 0;
};

async function listRecords(
  kind: RecordKind,
  userId: string,
  nextToken?: string
) {
  const result = await db.list<RecordBody>(tableFor(kind, userId), {
    limit: 100,
    ...(nextToken ? { nextToken } : {}),
  });

  // Normalize legacy decimal records while exposing canonical minor units.
  const items = result.items.map(item => {
    if (kind === 'projects') {
      const budgetMinor = legacyMinorUnits(item.budgetMinor, item.budget);
      return { ...item, budgetMinor, budget: budgetMinor / 100 };
    }
    if (kind === 'invoices') {
      const amountMinor = legacyMinorUnits(item.amountMinor, item.amount);
      const paidMinor = legacyMinorUnits(item.paidMinor, item.paid);
      return {
        ...item,
        amountMinor,
        paidMinor,
        amount: amountMinor / 100,
        paid: paidMinor / 100,
      };
    }
    return item;
  });

  return { items, nextToken: result.nextToken };
}

async function getOwnedClient(userId: string, clientId: string) {
  if (!clientId) return null;
  const [client] = await db.get<RecordBody>(
    tableFor('clients', userId),
    [clientId],
    { consistent: true }
  );
  return client;
}

function validateClient(body: RecordBody) {
  const name = text(body.name, 120);
  const company = text(body.company, 160);
  const email = text(body.email, 254).toLowerCase();
  const phone = text(body.phone, 40);
  const status = text(body.status || 'Active', 20);
  if (!name) return { error: 'Client name is required' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: 'Enter a valid email address' };
  if (!['Active', 'Lead', 'Inactive'].includes(status))
    return { error: 'Choose a valid client status' };
  return { record: { name, company, email, phone, status } };
}

async function validateProject(
  body: RecordBody,
  userId: string,
  existing?: RecordBody
) {
  const name = text(body.name ?? existing?.name, 140);
  const clientId = text(body.clientId ?? existing?.clientId, 128);
  const service = text(body.service ?? existing?.service, 120);
  const dueDate = body.dueDate ?? existing?.dueDate ?? '';
  const status = text(body.status ?? existing?.status ?? 'Planning', 24);
  const budgetInput =
    body.budget !== undefined
      ? body.budget
      : existing?.budgetMinor !== undefined
        ? (Number(existing.budgetMinor) / 100).toFixed(2)
        : existing?.budget ?? 0;
  const budgetMinor = toMinorUnits(budgetInput);
  const budget = budgetMinor === null ? NaN : budgetMinor / 100;
  const progress = numberValue(body.progress ?? existing?.progress ?? 0);

  if (!name) return { error: 'Project name is required' };
  if (!clientId) return { error: 'Select a client for this project' };
  if (budgetMinor === null)
    return {
      error: 'Project budget must be a non-negative KES amount with at most two decimal places',
    };
  if (!Number.isInteger(progress) || progress < 0 || progress > 100)
    return { error: 'Project progress must be a whole number from 0 to 100' };
  if (!validDate(dueDate)) return { error: 'Enter a valid project due date' };
  if (!['Planning', 'In Progress', 'On Hold', 'Completed'].includes(status))
    return { error: 'Choose a valid project status' };

  const client = await getOwnedClient(userId, clientId);
  if (!client)
    return { error: 'The selected client was not found in this workspace' };

  return {
    record: {
      name,
      clientId,
      clientName: text(client.name, 120),
      service,
      dueDate: text(dueDate, 10),
      status,
      budget,
      budgetMinor,
      progress,
    },
  };
}

async function createRecord(
  kind: RecordKind,
  userId: string,
  body: RecordBody
) {
  let fields: RecordBody;
  if (kind === 'clients') {
    const result = validateClient(body);
    if (result.error) return { error: result.error };
    fields = result.record!;
  } else if (kind === 'projects') {
    const result = await validateProject(body, userId);
    if (result.error) return { error: result.error };
    fields = result.record!;
  } else {
    const clientId = text(body.clientId, 128);
    const client = await getOwnedClient(userId, clientId);
    const amountMinor = toMinorUnits(body.amount);
    const paidMinor = toMinorUnits(body.paid ?? 0);
    if (!client) return { error: 'Select a valid client from this workspace' };
    if (amountMinor === null || amountMinor <= 0)
      return {
        error: 'Invoice amount must be positive KES with at most two decimal places',
      };
    if (paidMinor === null || paidMinor > amountMinor)
      return {
        error: 'Paid amount must be between zero and the invoice total, with at most two decimal places',
      };
    const amount = amountMinor / 100;
    const paid = paidMinor / 100;
    const dueDate = body.dueDate ?? '';
    if (!validDate(dueDate)) return { error: 'Enter a valid invoice due date' };
    const number = text(body.number, 40) || 'INV-' + Date.now().toString().slice(-8);
    fields = {
      number,
      clientId,
      clientName: text(client.name, 120),
      amount,
      paid,
      amountMinor,
      paidMinor,
      dueDate: text(dueDate, 10),
      status: paid >= amount ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
    };
  }

  const now = new Date().toISOString();
  const record = {
    ...fields,
    ownerId: userId,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  const [id] = await db.add(tableFor(kind, userId), [record]);
  if (!id) return { error: 'Record could not be created' };
  return { record: { ...record, id } };
}

export const handler = router({
  'GET /api/workspace': [
    requireAuth(),
    async ctx => {
      const userId = ctx.user!.userId;
      const requestedKind = ctx.query.kind;
      const cursor = ctx.query.cursor;

      if (cursor && !requestedKind)
        return error('A record type is required when using a page cursor', 400);
      if (cursor && cursor.length > 2048)
        return error('The page cursor is invalid', 400);

      if (requestedKind) {
        if (!['clients', 'projects', 'invoices'].includes(requestedKind))
          return error('Choose a valid workspace record type', 400);
        const page = await listRecords(
          requestedKind as RecordKind,
          userId,
          cursor || undefined
        );
        return json(page);
      }

      const [clients, projects, invoices] = await Promise.all([
        listRecords('clients', userId),
        listRecords('projects', userId),
        listRecords('invoices', userId),
      ]);
      return json({
        clients: clients.items,
        projects: projects.items,
        invoices: invoices.items,
        nextTokens: {
          clients: clients.nextToken,
          projects: projects.nextToken,
          invoices: invoices.nextToken,
        },
      });
    },
  ],
  'POST /api/clients': [
    requireAuth(),
    async ctx => {
      if (!isObject(ctx.body))
        return error('A valid client record is required', 400);
      const result = await createRecord('clients', ctx.user!.userId, ctx.body);
      return result.error ? error(result.error, 400) : json(result.record, 201);
    },
  ],
  'POST /api/projects': [
    requireAuth(),
    async ctx => {
      if (!isObject(ctx.body))
        return error('A valid project record is required', 400);
      const result = await createRecord('projects', ctx.user!.userId, ctx.body);
      return result.error ? error(result.error, 400) : json(result.record, 201);
    },
  ],
  'PUT /api/projects/:id': [
    requireAuth(),
    async ctx => {
      if (!isObject(ctx.body))
        return error('A valid project update is required', 400);
      const userId = ctx.user!.userId;
      const [current] = await db.get<RecordBody>(
        tableFor('projects', userId),
        [ctx.params.id],
        { consistent: true }
      );
      if (!current) return error('Project was not found', 404);

      const result = await validateProject(
        { ...current, ...ctx.body },
        userId,
        current
      );
      if (result.error) return error(result.error, 400);

      const record = {
        ...current,
        ...result.record,
        ownerId: userId,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        revision:
          Number.isSafeInteger(current.revision) && Number(current.revision) >= 0
            ? Number(current.revision) + 1
            : 1,
      };
      const [updated] = await db.tx.update(
        tableFor('projects', userId),
        [{
          id: ctx.params.id,
          record,
          if: { revision: current.revision },
        }],
        { patch: true }
      );
      return updated
        ? json({ updated: true, revision: record.revision })
        : error('This project changed while you were editing it. Reload and try again.', 409);
    },
  ],
  'POST /api/invoices': [
    requireAuth(),
    async ctx => {
      if (!isObject(ctx.body))
        return error('A valid invoice record is required', 400);
      const result = await createRecord('invoices', ctx.user!.userId, ctx.body);
      return result.error ? error(result.error, 400) : json(result.record, 201);
    },
  ],
});
