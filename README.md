# JK Tech Business Manager

A client, project, and invoice workspace built for JK Tech Code, designed to grow into a secure business operations SaaS for African SMEs.

## Features

- Authenticated workspace with user-scoped records
- Client directory and contact management
- Project tracking, status, progress, budgets, and deadlines
- Invoice tracking with paid and outstanding balances
- KES currency formatting and responsive desktop/mobile interface

## Technology

- React 19 and TypeScript
- Vite
- Tailwind CSS
- Lucide icons
- AppDeploy authentication, API client, database, and backend runtime

## Development

This project was exported from its AppDeploy source snapshot. The backend imports `@appdeploy/sdk` and the frontend imports `@appdeploy/client`; these platform packages and their runtime services are supplied by the AppDeploy environment.

The repository preserves the AppDeploy project source and deployment configuration. To run or deploy outside AppDeploy, first provide compatible implementations/configuration for those platform services.

## Source

Live application: https://jk-tech-client-project-manager-2slezn.v2.appdeploy.ai/

## Notes

- Do not commit credentials, access tokens, environment files, or production data.
- The `tests/tests.json` file contains AppDeploy workflow test definitions.


## Current release scope

The deployed release provides authenticated, user-scoped client, project and invoice workflows. Project and invoice amounts now include integer KES minor-unit fields while legacy decimal fields remain available for compatibility. Workspace reads are bounded to 100 records per entity; pagination remains planned.

## Security and architecture boundaries

- AppDeploy authentication protects workspace API routes.
- Records are partitioned by authenticated user ID; organization membership, staff roles and multi-tenant organization administration are not yet implemented.
- AppDeploy uses a key-value/document database, not relational SQL migrations.
- M-Pesa, external AI, client portal, quotations, expense ledger and automated workflows remain roadmap items.
- Workflow definitions in `tests/tests.json` are specifications, not proof of execution.

## Engineering documentation

See [Architecture](ARCHITECTURE.md), [Database schema](DATABASE_SCHEMA.md), [Security](SECURITY.md), [API](API_DOCUMENTATION.md), [Deployment](DEPLOYMENT.md), [Testing](TESTING.md), [Changelog](CHANGELOG.md), and [Implementation roadmap](IMPLEMENTATION_ROADMAP.md).


## P1 data reliability update

- Client, project and invoice lists use bounded 100-record pages and opaque continuation cursors.
- The list views provide a Load more action; earlier rows are retained and duplicate IDs are filtered when pages are appended.
- Project updates use a revision condition and patch write. A stale concurrent edit receives HTTP 409 rather than silently replacing a newer update.
- Newly created records include revision and updated-at metadata. Existing projects without a revision are upgraded on their first successful edit.
- Dashboard totals are based on records currently loaded into the workspace; the list pages expose further records on demand.

This milestone does not yet implement request idempotency receipts, immutable payment ledger entries or organization-level tenancy.


### Idempotent create requests

- New client, project and invoice submissions carry a UUID request ID.
- The request ID is reused when the same unchanged form is retried after a network or response failure.
- The server uses a chosen database record ID and stores a payload fingerprint with the record. A retry returns the original record instead of creating a duplicate.
- Reusing the same request ID for different data is rejected with HTTP 409. Uncertain outcomes return HTTP 503 and instruct the user to retry the unchanged submission.
- Internal request fingerprints are not included in workspace API responses.

This protects application create retries; it is not a payment-provider idempotency ledger.
