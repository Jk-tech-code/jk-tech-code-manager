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
const validDate = (value: unknown) =>
  value === undefined ||
  value === '' ||
  (typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + 'T00:00:00Z')));

async function listRecords(kind: RecordKind, userId: string) {
  const result = await db.list<RecordBody>(tableFor(kind, userId), {
    limit: 100,
  });
  return result.items;
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
  const budget = numberValue(body.budget ?? existing?.budget ?? 0);
  const progress = numberValue(body.progress ?? existing?.progress ?? 0);

  if (!name) return { error: 'Project name is required' };
  if (!clientId) return { error: 'Select a client for this project' };
  if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000_000_000)
    return { error: 'Project budget must be a valid non-negative amount' };
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
    const amount = numberValue(body.amount);
    const paid = numberValue(body.paid ?? 0);
    if (!client) return { error: 'Select a valid client from this workspace' };
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000)
      return { error: 'Invoice amount must be greater than zero' };
    if (!Number.isFinite(paid) || paid < 0 || paid > amount)
      return { error: 'Paid amount must be between zero and the invoice total' };
    const dueDate = body.dueDate ?? '';
    if (!validDate(dueDate)) return { error: 'Enter a valid invoice due date' };
    const number = text(body.number, 40) || 'INV-' + Date.now().toString().slice(-8);
    fields = {
      number,
      clientId,
      clientName: text(client.name, 120),
      amount,
      paid,
      dueDate: text(dueDate, 10),
      status: paid >= amount ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
    };
  }

  const record = {
    ...fields,
    ownerId: userId,
    createdAt: new Date().toISOString(),
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
      const [clients, projects, invoices] = await Promise.all([
        listRecords('clients', userId),
        listRecords('projects', userId),
        listRecords('invoices', userId),
      ]);
      return json({ clients, projects, invoices });
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
        ...result.record,
        ownerId: userId,
        createdAt: current.createdAt,
      };
      const [updated] = await db.update(tableFor('projects', userId), [
        { id: ctx.params.id, record },
      ]);
      return updated ? json({ updated: true }) : error('Project was not found', 404);
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
