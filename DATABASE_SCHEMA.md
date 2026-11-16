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
