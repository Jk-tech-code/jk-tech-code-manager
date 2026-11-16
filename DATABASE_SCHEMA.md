# Database schema

## Current logical collections

| Pattern | Fields | Purpose |
|---|---|---|
| `clients_<userKey>` | name, company, email, phone, status, ownerId, createdAt | Contact directory |
| `projects_<userKey>` | name, clientId, clientName, service, dueDate, status, budget, budgetMinor, progress, ownerId, createdAt | Project tracking |
| `invoices_<userKey>` | number, clientId, clientName, amount, paid, amountMinor, paidMinor, dueDate, status, ownerId, createdAt | Invoice tracking |

The API currently reads at most 100 records per collection; it does not yet follow AppDeploy `nextToken` pagination.

## Money
KES values use integer minor units (100 minor units = KSh 1). `budgetMinor`, `amountMinor`, and `paidMinor` are canonical for new writes. Decimal fields remain for UI and legacy compatibility. Old records are normalized on read; no destructive backfill is required. Inputs with more than two decimal places are rejected.

## Existing integrity
Project and invoice client references are resolved from the authenticated user's client collection. Status, progress, amounts, paid amount and due-date formats are server-validated. Relational foreign keys, immutable payment ledger, soft deletion, cross-entity transactions and unique invoice-number constraints are not yet implemented.

## Future model (not implemented)
Organizations, memberships, roles, leads, tasks, milestones, quotations, payments, expenses, suppliers, documents, notifications and activity events require tenant-scoped keys, bounded indexes/queries and a documented migration/backfill plan. Do not create SQL migrations for the current AppDeploy key-value store.


## P1 pagination and revision metadata

- Workspace reads use `db.list` with a page size of 100 and return `nextToken` when more records exist.
- The client requests further pages by record type; it does not drain all pages in a single request.
- New records include `revision: 1` and `updatedAt`.
- Project edits advance `revision` and set `updatedAt`. The update uses a conditional patch against the previous revision, including an absence condition for legacy records without a revision.
- This is optimistic concurrency control, not a full transaction across related business records.


## Idempotency metadata

Newly created client, project and invoice records use the client-generated UUID request ID as their database record ID and store an internal `requestFingerprint` derived from the normalized validated fields. The fingerprint is removed from API responses. A matching retry returns the existing record; reuse of the ID for different normalized fields is rejected. This avoids a second receipt table and keeps the record and idempotency marker in one chosen-ID write.
