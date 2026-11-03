---
description: Hearing aids on trial: when each trial ends and whether the follow-up is booked
---

Run `npm run clinic -- trials --json`. Overdue trials first (decide kept or returned), then trials ending in 7 days with no follow-up. Offer `/book` for each missing follow-up and `/draft-trial-check` for the client. Say plainly if it is empty. Never change a record from this command.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
