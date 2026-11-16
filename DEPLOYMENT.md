# Deployment

- Platform: AppDeploy.
- App ID: `jk-tech-client-project-manager-2slezn`.
- Live URL: https://jk-tech-client-project-manager-2slezn.v2.appdeploy.ai/
- Source deploys from an AppDeploy snapshot; GitHub is the version-control mirror.

The exported source imports `@appdeploy/client` and `@appdeploy/sdk`, supplied by the AppDeploy runtime. Standalone Vercel deployment is not configured without compatible implementations and configuration.

## Release checklist
- Review source snapshot and diff.
- Keep secrets out of source control and frontend bundles.
- Update the existing app ID, not a duplicate app.
- Inspect deployment state, frontend/backend errors and QA results.
- Smoke-test authentication and client/project/invoice workflows.
- Sync deployed source and repository only after checking for secrets.

Staging/production separation, automated backup verification, rollback drills and CI gates remain future work.
