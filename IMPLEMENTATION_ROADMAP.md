# Implementation roadmap

| Priority | Workstream | Deliverables | Exit gate |
|---|---|---|---|
| P0 | Foundation | Strict validation, exact minor-unit money, legacy compatibility, docs, QA | No introduced regressions; deployment QA ready |
| P1 | Data reliability | Pagination, request IDs/idempotency, concurrency-safe edits, observability | Bounded reads and replay-safe writes |
| P2 | Team and tenancy | Organizations, memberships, roles, invitations, tenant authorization | Cross-tenant tests pass |
| P3 | CRM | Leads, sources, stages, assignments, follow-ups, timeline, lead-to-project | CRM E2E passes |
| P4 | Project delivery | Tasks, milestones, teams, time tracking, templates, deliverables | Ownership/progress integrity verified |
| P5 | Finance | Quotations, append-only payments, expenses, suppliers, reports, PDFs | Reconciliation/accounting tests pass |
| P6 | Kenya integrations | Daraja STK push/callbacks, reconciliation, notifications | Sandbox, idempotency and security review |
| P7 | Client portal | Scoped client identities, project access, approvals, documents | Client isolation tests pass |
| P8 | AI and automation | Permission-filtered retrieval, approvals, execution log | Data-boundary and duplicate-job tests pass |
| P9 | SaaS operations | Plans, entitlements, onboarding, super-admin, exports, backups | Restore drill and tenant isolation review |

Do not begin broad redesign while P0/P1 correctness gates remain open. Deliver each workstream in independently reviewable milestones.


## Status update

- **P0 Foundation:** delivered in the Phase 1 foundation branch.
- **P1 Data reliability:** initial milestone delivered — bounded cursor pagination and conditional project updates are implemented. Remaining P1 work includes request-idempotency receipts, safe retry/reconciliation patterns, broader audit events and measured load/performance testing.
- **P2 Team and tenancy:** next — organization membership, role permissions and cross-tenant isolation.


- **P1 Data reliability:** pagination, optimistic project concurrency and idempotent client/project/invoice creation are implemented. Remaining P1 work includes broader audit events and measured load/performance testing.
