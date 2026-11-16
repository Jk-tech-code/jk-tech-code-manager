# Changelog

## Phase 1 — Foundation
- Tightened ISO calendar date validation to reject impossible normalized dates.
- Added KES integer minor-unit parsing for project budgets and invoice totals/payments.
- Kept legacy decimal fields readable and retained them for compatibility.
- Updated dashboard totals and currency display to use integer minor units.
- Added workflow definitions for decimal precision and impossible dates.
- Added architecture, database, security, API, deployment, testing and roadmap documentation.

Organization-level tenancy, staff roles, payment processing, audit trails and a production accounting ledger are not part of this milestone.


## P1 — Data reliability
- Added 100-record cursor pagination for clients, projects and invoices.
- Added Load more controls that append pages while retaining existing records and filtering duplicate IDs.
- Added record revision and updated-at metadata.
- Replaced project full-record replacement with conditional patch updates to prevent stale concurrent edits from silently overwriting newer values.
- Added pagination and concurrent-update workflow coverage.


- Added stable UUID request IDs to client, project and invoice creation.
- Added chosen-ID writes and payload-fingerprint reconciliation so unchanged retries return the original record instead of creating duplicates.
- Rejected request-ID reuse with different normalized content; returned a retry-safe HTTP 503 when a write outcome could not be confirmed.
- Kept internal request fingerprints out of API responses and made generated invoice numbers stable across retries.


- Narrowed idempotency reconciliation to duplicate-ID and unknown-outcome database errors so quota, authorization and other failures are not masked.
