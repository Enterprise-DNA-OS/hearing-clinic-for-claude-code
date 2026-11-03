---
description: Bring clients, appointments and hearing aids across from Auditdata Manage exports
---

Read `docs/replace-auditdata-manage.md`. Run `npm run clinic -- import auditdata <folder> --dry-run` first and show the counts. Map different headings with `--map=file.json`. Only run without `--dry-run` once the operator says yes. Afterwards run `/trials`, `/recalls` and `/devices` and compare with Auditdata Manage.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
