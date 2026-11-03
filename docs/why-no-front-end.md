# Why there is no front end

Auditdata Manage is a database with a subscription. The tables underneath it are ordinary: a few entities, a few relationships, a handful of workflows you repeat every week. What you pay for is the layer on top that lets people who do not write SQL get at those tables. Screens, filters, dashboards, forms.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, describe what you want, and it writes the query, runs it, and explains the answer. Ask a question the dashboard never had a chart for and you still get an answer.

## What you gain

- **Better answers.** A dashboard shows what the vendor decided to chart. Here you ask your own question, in your own words, and get it answered against your own data.
- **No seats.** Everyone who needs to look can look. The bill does not grow with headcount.
- **Your data in your Postgres.** Plain tables. Back them up, query them from anything, leave any time. There is no export step because there is nothing to leave.
- **A process that matches you.** When your way of working changes, you add a command. You do not wait for a feature request to clear.

## What you give up

- **An appointment grid on a screen.** The book is a list you ask about ("what is on tomorrow for Mia?"), not a calendar you drag appointments around in.
- **Noah and audiometer integration.** Audiograms stay in Noah; you record the four thresholds per ear that the rules and reports need.
- **Online booking and text reminders.** Reminders are drafted for a person to send. A booking page and automatic texts are something Enterprise DNA builds into an installed version.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for clinics that want someone to call.

## Who this fits

Small teams who already use Claude Code, or who would rather learn to ask than learn another interface. If your front desk needs a booking screen open all day, keep one for that, or have Enterprise DNA build it on top of this database. If you need the answers more than the screens, this is cheaper, faster and yours.

Installed and run for you: https://enterprisedna.co/omni/instead-of/auditdata-manage
