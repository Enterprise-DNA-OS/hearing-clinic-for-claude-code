<h1 align="center">Hearing Clinic for Claude Code</h1>

<p align="center">
  <strong>The open-source hearing clinic system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Auditdata Manage data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=auditdata-manage">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/auditdata-manage?utm_source=github&utm_medium=readme&utm_campaign=auditdata-manage">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-auditdata-manage">Instead of Auditdata Manage</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Hearing Clinic for Claude Code does the job you pay Auditdata Manage for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Auditdata Manage dashboard cannot.

Auditdata Manage does not publish a price. Its pricing page says "There is no one-size-fits-all list price" and offers a custom quote, pitched at groups of three clinics and up ([auditdata.com/pricing](https://www.auditdata.com/pricing)). The bill grows with every clinic you open, and the records it holds (clients, hearing aids, trials, funder claims) are the ones your practice lives on.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=auditdata-manage).

It is for independent hearing clinics and small hearing groups in Australia and New Zealand, from a single audiologist to a group of clinics across a region. It holds clients and their funder (private, the Hearing Services Program, the MSD subsidy, ACC, the Hearing Aid Funding Scheme), every hearing test's thresholds and averages, the appointment book, every hearing aid with its serial, trial, warranty and repairs, HSP vouchers and funder approvals, claims, invoices and payments. It checks the funder rules before an appointment or a fitting goes ahead. It does not replace Noah for audiograms, run the audiometer, or lodge claims in a funder's portal.

The fictional Tasman Hearing demo has a clinic on the Gold Coast and one in Auckland, four clinicians and sixteen clients. Tomorrow a fitting is booked with no signed quote, two of Mia's appointments overlap, and James is booked for a fitting with his registration lapsed. A trial ended ten days ago with nobody deciding, another ends in six days with no follow-up booked, a client tested with a loss worth fitting went 40 days without a call, an HSP client was fitted on an expired voucher, another was refitted inside five years, an ACC client was fitted before approval, and a $520 HSP claim has sat unlodged for 60 days.

## Your first hour: ten things to ask for

1. "What is wrong with tomorrow's book?"
2. "Which trials end this week, and is the follow-up booked?"
3. "Who did we test with a loss and never fitted?"
4. "Who is due their annual review and not booked?"
5. "Which clients can have new hearing aids this year under their funder?"
6. "Which claims have we not lodged?"
7. "Which hearing aids have been at the manufacturer more than three weeks?"
8. "Which clinician has the most returns, and why do people return them?"
9. "Write a letter to Robert's GP about his latest test."
10. "Add a field for the client's preferred clinic day." (`/customise`)

## Ten questions the Auditdata Manage dashboard does not answer

Each runs against the demo today, through the command shown.

| Question | Command |
|---|---|
| Which appointments tomorrow should not go ahead as booked, and why (consent, voucher, approval, test, registration, double booking, overdue account)? | `/tomorrow` |
| Which trials end in the next seven days with no follow-up booked, and which have already ended with no decision? | `/trials` |
| Who was tested with a loss worth fitting, and how long ago, with nothing since? | `/unfitted` |
| Which clients can have new aids under their funder's own interval (five years HSP, six years MSD, ACC and the Funding Scheme)? | `/upgrades` |
| Whose hearing has dropped 10 dB or more since their previous test? | `/changed` |
| Which HSP fittings were done on an expired voucher, or refitted inside five years without a lost or damaged reason? | `/compliance` |
| Which ACC or Funding Scheme fittings went ahead before the approval was on file? | `/compliance` |
| Which claims are not lodged, and which are close to the HSP's six-month limit? | `/claims` |
| For each clinician: tests, fit recommendations, aids kept, aids returned and clients tested but never fitted? | `/results` |
| Which referral sources send tests but never turn into fittings? | `/referrals` |

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/hearing-clinic-for-claude-code.git
cd hearing-clinic-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/tomorrow`, then `/attention`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

59 commands, one per recurring job. The CLI behind them is `npm run clinic -- help`.

| Command | What it does |
|---|---|
| `/add` | Add a clinic, clinician, client or product |
| `/approval` | Record a funder approval (ACC, the Funding Scheme, MSD) |
| `/attend` | Mark an appointment attended |
| `/attention` | What needs chasing today: appointment problems, trials ending, clients tested and not fitted, reviews due, repairs, claims, accounts, clients due new aids, warranties, vouchers, no-shows, registrations |
| `/book` | Book an appointment, refused if it has a problem |
| `/cancel` | Cancel an appointment |
| `/changed` | Clients whose hearing has dropped 10 dB or more since their previous test |
| `/claim-paid` | Mark a claim paid |
| `/claim` | Raise a claim to a funder |
| `/claims` | Claims to the HSP, MSD, ACC and the Funding Scheme: not lodged, waiting, paid |
| `/client` | One client's whole file: details, tests, devices, appointments, claims, funding and notes |
| `/clinician` | One clinician: results, bookings, trials and clients tested but not fitted |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited. |
| `/consent` | Record the signed quote and consent |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/debtors` | Who owes the clinic money and how overdue |
| `/devices` | Every hearing aid and accessory in clients' hands, with serials and warranties |
| `/documents` | Render the paperwork: device quotes for signing, hearing aid records, statements |
| `/draft-gp-letter` | Draft the hearing assessment report to the client's GP |
| `/draft-recall` | Draft a review reminder for a client |
| `/draft-statement` | Draft a statement of account |
| `/draft-trial-check` | Draft a trial check-in for a client |
| `/draft-upgrade` | Draft a letter to a client due new hearing aids |
| `/end-of-day` | Close the day: attended or not, trials started, claims to raise, tomorrow checked |
| `/export` | Export every record to JSON |
| `/fit` | Fit hearing aids and start the trial, refused if a funder rule would be broken |
| `/import` | Bring clients, appointments and hearing aids across from Auditdata Manage exports |
| `/invoice` | Invoice a client |
| `/keep` | Client is keeping the aids: end the trial |
| `/lodge` | Mark a claim lodged with the funder |
| `/log` | Add a note to a client's file |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/no-show` | Mark a no-show and offer to rebook |
| `/pay` | Record a payment |
| `/recalls` | Clients due their annual hearing review with nothing booked |
| `/referrals` | Where clients come from and which sources turn into fittings |
| `/repair` | Send a hearing aid away for repair |
| `/repaired` | A repair came back |
| `/repairs` | Hearing aids away for repair, how long, and whether under warranty |
| `/results` | Per clinician over 180 days: tests, fit recommendations, aids fitted, kept, returned, value kept, tested and not fitted |
| `/retention` | Client records and how long each must be kept (7 years AU, 10 years NZ, from the last service) |
| `/return` | Client is returning aids from the trial |
| `/returns` | Hearing aids returned after trial, by clinician and reason |
| `/schedule` | Every appointment booked from today on, with problems |
| `/setting` | Change a house setting or funder limit |
| `/settings` | The house settings and funder limits the rules use |
| `/status` | Archive a client or mark them deceased |
| `/takings` | Money received by month, last 12 months |
| `/test` | Record a hearing test from the audiogram |
| `/today` | Today's appointment book, with anything that should stop an appointment going ahead as booked |
| `/tomorrow` | Tomorrow's appointment book checked the afternoon before: consent, vouchers, approvals, tests, registrations, double bookings, overdue accounts |
| `/trials` | Hearing aids on trial: when each trial ends and whether the follow-up is booked |
| `/unfitted` | Clients tested with a loss worth fitting and no trial since: the fittings the clinic is leaving on the table |
| `/upgrades` | Clients whose hearing aids are old enough for new ones under their funder's rule (HSP 5 years, NZ funders 6 years, private house setting) |
| `/view` | Render the dashboards: the week, fittings and recalls, compliance |
| `/voucher` | Record an HSP voucher |
| `/vouchers` | Hearing Services Program vouchers and when each runs out |
| `/warranties` | Warranties ending in the next 90 days (and just ended) |
| `/weekly-review` | The Monday review written from the book, the trials, the growth lists, claims and money |

`npm run view` renders the week, fittings and recalls, and compliance as HTML dashboards in your brand (`brand.json`). `npm run docs` renders device quotes for signing, hearing aid records and statements.

## Instead of Auditdata Manage

Export the Clients, Appointments and Sales reports from Auditdata Manage to CSV, then:

```bash
npm run clinic -- import auditdata ./my-export --dry-run
npm run clinic -- import auditdata ./my-export
```

Clients, clinicians, appointment history and every hearing aid with its serial come across. Audiograms stay in Noah: enter each active client's latest thresholds with `/test`. The full guide, with the column map and what does not carry over, is [docs/replace-auditdata-manage.md](docs/replace-auditdata-manage.md). The rules the system checks, with their sources, are in [docs/compliance.md](docs/compliance.md).

## Architecture

```
hearing-clinic-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis, the compliance rules and the migration guide
  views.json, documents.json  the dashboards and paperwork, as SQL
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Hearing Clinic for Claude Code for your business, migrates your Auditdata Manage data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=auditdata-manage)
- Read more: [enterprisedna.co/omni/instead-of/auditdata-manage](https://enterprisedna.co/omni/instead-of/auditdata-manage?utm_source=github&utm_medium=readme&utm_campaign=auditdata-manage)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
