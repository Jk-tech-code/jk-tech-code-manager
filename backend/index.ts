import { router, json, error, db, requireAuth } from '@appdeploy/sdk';

type RecordBody = Record<string, unknown>;
const safe = (value: string) => value.replace(/[^A-Za-z0-9_.-]/g, '_');
const tableFor = (kind: string, userId: string) => kind + '_' + safe(userId);
const allowed = ['clients', 'projects', 'invoices'];

async function listRecords(kind: string, userId: string) {
  const result = await db.list<RecordBody>(tableFor(kind, userId), {
    limit: 100,
  });
  return result.items;
}
async function createRecord(kind: string, userId: string, body: RecordBody) {
  const record = { ...body, ownerId: userId };
  const [id] = await db.add(tableFor(kind, userId), [record]);
  if (!id) throw new Error('Record could not be created');
  return { ...record, id };
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
      const body = (ctx.body || {}) as RecordBody;
      if (typeof body.name !== 'string' || !body.name.trim())
        return error('Client name is required', 400);
      return json(await createRecord('clients', ctx.user!.userId, body), 201);
    },
  ],
  'POST /api/projects': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as RecordBody;
      if (typeof body.name !== 'string' || !body.name.trim())
        return error('Project name is required', 400);
      return json(await createRecord('projects', ctx.user!.userId, body), 201);
    },
  ],
  'PUT /api/projects/:id': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as RecordBody;
      const record = { ...body, ownerId: ctx.user!.userId };
      const [ok] = await db.update(tableFor('projects', ctx.user!.userId), [
        { id: ctx.params.id, record },
      ]);
      return ok ? json({ updated: true }) : error('Project was not found', 404);
    },
  ],
  'POST /api/invoices': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as RecordBody;
      if (typeof body.amount !== 'number' || body.amount <= 0)
        return error('Invoice amount must be greater than zero', 400);
      return json(await createRecord('invoices', ctx.user!.userId, body), 201);
    },
  ],
});
