# Security posture

## Current controls
- All workspace routes require AppDeploy authentication.
- User identity comes from authenticated server context, not request body.
- Project/invoice client references are resolved from the current user's client collection.
- Backend validates client names/email/status, project status/progress/budget/date, and invoice amount/payment/date.
- Project update lookup uses a consistent read in a user-scoped collection.

## Known gaps
- No organization tenant model, staff roles, invitations or resource-level permission matrix.
- No dedicated rate-limit policy or application audit event stream.
- MFA is not configured by this application; authentication is platform-managed.
- No upload endpoints or file scanning.
- No M-Pesa callback route, provider credential integration or payment idempotency.
- Workspace reads are capped at 100 records and need pagination.

## Future security requirements
1. Resolve tenant and user identity from verified server-side auth/membership data.
2. Enforce permissions on every API route; frontend visibility is not authorization.
3. Bound and validate user-controlled input and uploaded content.
4. Keep provider credentials in AppDeploy backend secrets, never frontend bundles/logs.
5. Use atomic transactions and idempotency receipts for payment effects.
6. Log security-relevant changes without storing secrets.
7. Test cross-tenant access, privilege escalation, replay and duplicate callbacks.

This is a factual posture note, not a certification or penetration-test report.
