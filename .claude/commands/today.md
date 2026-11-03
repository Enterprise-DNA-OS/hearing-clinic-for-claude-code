---
description: Today's appointment book, with anything that should stop an appointment going ahead as booked
---

Run `npm run clinic -- today --json`. Show the day in time order by clinician. Put appointments with problems first and say what fixes each one (consent, a voucher, an approval, a test, a registration). Say plainly if it is empty. Never change a record from this command.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
