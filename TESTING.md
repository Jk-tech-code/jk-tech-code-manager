# Testing

`tests/tests.json` defines AppDeploy browser workflows for sign-in/workspace loading, client creation, project create/update, invoice validation and balance display. These definitions are not themselves an execution report.

## Phase 1 targets
- Existing client, project and invoice workflows remain functional.
- Invalid email/status and cross-user client references are rejected.
- Impossible calendar dates such as 2026-02-31 are rejected.
- KES values with at most two decimal places are stored as integer minor units.
- More than two decimal places and invoice overpayments are rejected.
- Legacy records without minor-unit fields remain readable.
- Desktop and mobile layouts remain usable.

Only report counts from an actual QA run or executed local command. No local npm build is claimed because the exported manifest does not include AppDeploy platform packages.


## P1 data reliability scenarios

The five workflow definitions now cover:
- Loading additional client records beyond the first 100 without losing or duplicating earlier rows.
- Editing the same project from two sessions; the stale second update must receive HTTP 409.
- Existing client/project/invoice workflows and KES minor-unit calculations.

The deployment QA snapshot reported zero frontend and network errors and zero backend errors. These are platform QA diagnostics, not a separately executed count of all five workflow scenarios.


## Idempotent create retry scenario

The client-creation workflow includes retrying an unchanged submission after a simulated lost response. The expected outcome is one saved client, with the original record returned on retry. Reusing the same request ID with different data must return HTTP 409. A request whose outcome cannot be reconciled returns HTTP 503 and must retain the same request ID for a safe retry.
