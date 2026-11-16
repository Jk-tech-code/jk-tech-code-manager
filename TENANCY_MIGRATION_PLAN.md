# Phase 2 — Organization tenancy and team access

## Goal

Introduce organization workspaces and team membership without losing or exposing any existing user-owned client, project or invoice records.

## Current baseline

- Authentication is provided by AppDeploy; the server receives a verified `ctx.user.userId`.
- Business collections are currently partitioned by authenticated user ID: `clients_<userKey>`, `projects_<userKey>`, and `invoices_<userKey>`.
- The current product has no organization table, membership index, role matrix, invitation flow or organization selector.
- Existing records must remain readable throughout migration. Do not change the current table-key function until migration and rollback paths are proven.

## Target logical model

| Collection | Key | Important fields |
|---|---|---|
| organizations | organizationId | name, ownerUserId, status, createdAt, updatedAt |
| membershipsByUser_<userKey> | organizationId | organizationId, role, status, joinedAt |
| membersByOrg_<orgKey> | userId | userId, role, status, invitedBy, joinedAt |
| clients_<orgKey> | existing record ID | existing client fields plus organizationId |
| projects_<orgKey> | existing record ID | existing project fields plus organizationId |
| invoices_<orgKey> | existing record ID | existing invoice fields plus organizationId |

Organization IDs and table keys must be server-generated, normalized and bounded. A client-supplied organization ID is only a selector; every request must verify an active membership before accessing data.

## Authorization model

Initial roles:

- **OWNER** — organization lifecycle, member administration, all workspace data.
- **ADMIN** — member management and all operational data, excluding ownership transfer/deletion.
- **MANAGER** — manage clients and delivery work; no membership or billing administration.
- **MEMBER** — assigned operational work and permitted client/project updates.
- **VIEWER** — read-only access to explicitly permitted workspace data.

Implement a central permission map and server-side authorization helper. Every API route must resolve the authenticated user's membership and check the required permission before reading or writing. Hiding controls in React is not an authorization control.

## Invitation flow

Use the AppDeploy SDK invite lifecycle rather than inventing invite tokens:

1. An authorized OWNER/ADMIN creates a required-auth invite with an allow-listed email and organization context.
2. The public resolve endpoint exposes only the invite's status and safe organization display context.
3. The authenticated recipient explicitly joins.
4. The application verifies the resolved resource type and organization status, then writes the membership index and organization member record.
5. Revoke is available only where the invite provider confirms the authenticated creator can revoke it.
6. Every join is idempotent; expired, revoked, wrong-email and cross-organization attempts are rejected.

## Backward-compatible migration plan

1. **Inventory:** count and page through every existing user-scoped collection. Capture record IDs and a deterministic content fingerprint. Do not alter source records.
2. **Provision:** create the owner's default organization and OWNER membership using deterministic IDs. Provision required table catalogs before transactional writes.
3. **Copy:** copy records in bounded pages to organization-scoped tables while preserving record IDs, money minor-unit fields, revision metadata, created/updated timestamps and idempotency fingerprints.
4. **Reconcile:** on a repeated migration page, compare the destination fingerprint. Matching records are treated as already copied; mismatches stop the migration for review.
5. **Verify:** compare source/destination counts and fingerprints for each collection. Store a durable per-collection checkpoint and verification result.
6. **Cut over:** only after all three collections verify, mark the organization migration complete and route reads/writes to organization tables.
7. **Rollback window:** retain source tables read-only until an agreed retention period and a successful restore drill. Never delete source records as part of the first cutover.
8. **Team access:** enable invitations only after tenant resolution and membership authorization are active on every endpoint.

## Critical implementation prerequisite

The current AppDeploy database SDK reference documents bounded reads, chosen-ID writes, conditional patches and transactions, but its exposed API reference does not document an explicit table-catalog provisioning operation. The SDK guidance states that missing table catalogs must be created separately before application writes.

Before implementing new organization and membership tables, confirm the supported table-catalog provisioning mechanism with AppDeploy. Do not guess a method, silently create partial tenancy, or deploy code that assumes new tables already exist.

## Required acceptance tests

- Existing owner sees all pre-migration clients, projects and invoices after migration.
- A second organization cannot read or mutate the first organization's records by guessing IDs or cursors.
- A non-member cannot resolve an organization workspace.
- VIEWER cannot write; MEMBER cannot manage invitations; MANAGER cannot change membership; ADMIN cannot transfer ownership.
- Invite allow-list, expiry, revocation and repeated-join behavior are enforced.
- Migration interruption and retry do not duplicate or overwrite destination records.
- Cutover is blocked on count/fingerprint mismatch.
- Legacy user-scoped source records remain intact during rollback window.

## Delivery sequence

- P2.1: verify database table provisioning and finalize migration tooling.
- P2.2: implement organization bootstrap and owner membership, retaining legacy reads.
- P2.3: implement resumable, idempotent data copy and reconciliation.
- P2.4: implement server-side membership resolution and role enforcement on all APIs.
- P2.5: implement invite creation, resolve, join and revoke.
- P2.6: add organization selector and team administration UI.
- P2.7: run cross-tenant and privilege-escalation tests before production cutover.

## Release gate

Do not enable organization sharing or invite-based access until P2.3–P2.5 and all tenant-isolation tests pass. This document is a design and implementation plan; it does not claim that multi-tenancy has been implemented.
