# Architecture

## Current runtime
- React 19 + TypeScript SPA, built with Vite.
- AppDeploy hosts frontend and backend routes.
- Frontend uses `@appdeploy/client` for authenticated API calls and auth redirects.
- Backend uses `@appdeploy/sdk` router, `requireAuth`, JSON responses and AppDeploy key-value database.
- Exported source depends on AppDeploy platform packages/runtime; standalone Vercel deployment is not configured.

## Request flow
1. AppDeploy authentication establishes user identity.
2. Frontend calls `GET /api/workspace`.
3. Backend applies `requireAuth()` and derives identity from `ctx.user`.
4. Backend reads user-scoped logical collections.
5. Writes validate input and resolve referenced clients inside the same user scope.

## Current boundaries
- Account-level user partitions exist; organization memberships and staff role matrix do not.
- Workspace reads are bounded to 100 records per entity and do not yet expose continuation tokens.
- AppDeploy tables are document/key-value collections, not relational tables with foreign keys or SQL migrations.
- Payment callbacks, integrations, scheduled jobs and AI are not enabled.

## Target evolution
Introduce organizations and memberships before team collaboration. Resolve tenant identity from authenticated server-side membership, never a client-supplied organization ID. Add domain services for CRM, delivery and finance. Use atomic transactions and stable idempotency receipts for financial writes where supported.


## P1 data reliability

- Workspace collections return a bounded first page of up to 100 records and per-collection continuation tokens.
- `GET /api/workspace?kind=clients|projects|invoices&cursor=<token>` returns one additional page. The token is opaque and is passed through to the AppDeploy database list API.
- Project updates use optimistic concurrency: the backend reads a consistent project record, then applies a patch only if the stored revision still matches. Successful writes advance the revision and update `updatedAt`.
- A stale revision returns HTTP 409. The UI asks the user to reload rather than silently overwriting a concurrent edit.


## Idempotent create operations

- The client creates a UUID request ID per form payload and retains it while retrying the same unchanged payload.
- The authenticated user's existing logical collection stores the new record under that chosen ID using `db.tx.add`. The record includes a server-generated payload fingerprint.
- A consistent read checks for an existing record before writing. A chosen-ID collision or uncertain write is reconciled by reading the same ID and comparing the fingerprint.
- Matching retries return the original record; mismatched payload reuse returns HTTP 409; unresolved outcomes return HTTP 503 so the client can retry with the same key.
- Fingerprint metadata is stripped from list and create responses.
