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
