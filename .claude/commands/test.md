---
description: Record a hearing test from the audiogram
---

Ask for the thresholds at 500, 1000, 2000 and 4000 Hz for each ear (or read them off the audiogram the clinician pastes). Run `npm run clinic -- test <client> --left=a,b,c,d --right=a,b,c,d --recommend=fit|review|refer|none [--note=".."]`. Show the averages and any change since the last test. The full audiogram stays in Noah.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
