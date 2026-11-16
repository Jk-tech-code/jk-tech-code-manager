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
