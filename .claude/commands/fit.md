---
description: Fit hearing aids and start the trial, refused if a funder rule would be broken
---

Confirm product, ears, serials, funder and price. Run `npm run clinic -- fit <client> --product=<code> --ears=L,R --serials=A,B [--funder=..] [--price=each] [--trial-days=30]`. If refused, explain each rule from docs/compliance.md. Then book the follow-up (`/book --kind=follow-up`, at least 7 days after for an HSP client) and render the quote (`npm run docs -- device-quote`) for signing.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
