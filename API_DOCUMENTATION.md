# API documentation

All listed routes require AppDeploy authentication.

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/workspace` | Returns clients, projects and invoices; max 100 records per collection |
| POST | `/api/clients` | Validates client name, email and status; assigns authenticated owner |
| POST | `/api/projects` | Requires same-workspace client; validates status, progress, due date and KES budget |
| PUT | `/api/projects/:id` | Loads project from caller's collection, validates merged state and updates record |
| POST | `/api/invoices` | Requires same-workspace client; validates amount, partial payment and due date |

## Monetary inputs
Project writes accept `budget`; invoice writes accept `amount` and optional `paid`. Amounts must be non-negative KES with at most two decimal places; invoice total must be positive and paid cannot exceed total. Responses include decimal compatibility fields and canonical integer minor-unit fields.

Validation errors return HTTP 400; missing project update returns HTTP 404. Authentication failures are handled by AppDeploy middleware.

Leads, tasks, quotations, expenses, payment callbacks, client portal, staff administration and organization management APIs are not implemented.


## Workspace pagination

- `GET /api/workspace` returns the first page of up to 100 clients, projects and invoices, plus `nextTokens` for collections with more records.
- `GET /api/workspace?kind=clients&cursor=<opaque-token>` returns `{ items, nextToken? }` for one additional page. Supported kinds are `clients`, `projects` and `invoices`.
- A cursor without a valid record kind is rejected. Cursors longer than 2,048 characters are rejected.
- The client appends new rows and filters duplicate record IDs.

## Concurrent project updates

`PUT /api/projects/:id` uses the current server-side revision as a conditional write guard. Successful updates return `{ updated: true, revision }`. A stale update returns HTTP 409 with a reload-and-retry message.
