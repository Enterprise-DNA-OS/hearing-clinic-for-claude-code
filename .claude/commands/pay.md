---
description: Record a payment
---

Run `npm run clinic -- pay <invoice|client> <amount> --ref=..`. A client name pays their oldest open invoice.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
