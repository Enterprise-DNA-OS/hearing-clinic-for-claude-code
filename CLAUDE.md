# Hearing Clinic for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What is on tomorrow / today, can it all go ahead | `/tomorrow`, `/today` |
| What needs chasing | `/attention` |
| Trials ending, follow-ups, kept or returned | `/trials`, `/keep`, `/return` |
| Tested and not fitted, reviews due, due new aids | `/unfitted`, `/recalls`, `/upgrades` |
| Book, attend, no-show, cancel | `/book`, `/attend`, `/no-show`, `/cancel` |
| Record a hearing test | `/test` |
| Fit hearing aids and start a trial | `/fit` |
| Repairs out and back | `/repairs`, `/repair`, `/repaired` |
| Vouchers, approvals, signed quote | `/voucher`, `/approval`, `/consent` |
| Claims to HSP, MSD, ACC, the Funding Scheme | `/claims`, `/claim`, `/lodge`, `/claim-paid` |
| Money owed, invoices, payments | `/debtors`, `/invoice`, `/pay`, `/draft-statement` |
| Funder rules and records | `/compliance`, `/retention` |
| How each clinician and referral source is doing | `/results`, `/referrals`, `/returns`, `/takings` |
| Letters and reminders (drafts only) | `/draft-recall`, `/draft-trial-check`, `/draft-gp-letter`, `/draft-upgrade` |
| The Monday review / closing the day | `/weekly-review`, `/end-of-day` |
| Dashboards and paperwork | `/view`, `/documents` |
| Moving off Auditdata Manage | `/import` |
| Change a field, rule or setting | `/customise`, `/setting` |

If an ask fits nothing here, run the CLI directly (`npm run clinic -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Clinic rules

- Check `tomorrow` every afternoon. A fitting needs a signed quote, a test in the last 12 months, and for HSP a current voucher, for ACC or the Funding Scheme an approval.
- A clinician decides the hearing. Never change a recommendation or a threshold on your own; record what the clinician says.
- Claims are lodged in the funder's own portal by a person. Here you only record that it was lodged and paid.
- Funder numbers in `settings` change only when the source in `docs/compliance.md` changes. Update both together.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Auditdata Manage.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/auditdata-manage
