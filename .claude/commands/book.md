---
description: Book an appointment, refused if it has a problem
---

Confirm client, date, time, kind and clinician, then run `npm run clinic -- book <client> --date=YYYY-MM-DD --start=HH:MM --kind=<kind> [--minutes=60] [--clinician=..]`. If it is refused, explain each problem and how to fix it. Add `--force` only when the clinic manager says yes in this session.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
