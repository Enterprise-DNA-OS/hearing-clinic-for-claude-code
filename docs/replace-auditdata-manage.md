# Moving off Auditdata Manage

You can bring your clients, appointment history and hearing aids across in an afternoon, and run both side by side until you trust the new one.

## 1. Export from Auditdata Manage

Auditdata Manage reports can be exported to Excel. Run these three and save each as CSV (in Excel: File, Save As, CSV UTF-8):

1. **Clients:** every client with number, name, date of birth, contact details, clinic, audiologist, funding or payer, referral source, GP and status.
2. **Appointments:** every appointment with client number, date, start time, duration, type, audiologist and status.
3. **Sales:** every hearing aid sold or on trial, with client number, sale or fitting date, manufacturer, product, side, serial number, price and status.

Put the three files in one folder and name them so they start with `Clients`, `Appointments` and `Sales`.

## 2. Do a test run

```bash
npm run clinic -- import auditdata ./my-export --dry-run
```

It reads every file, checks every row and shows the counts, then changes nothing. If a heading in your export is different (for example `Cust No` instead of `Client number`), write a small map file and pass it with `--map=map.json`:

```json
{ "clients": { "Client number": "Cust No" }, "devices": { "Serial number": "S/N" } }
```

Then run it for real (without `--dry-run`). Running it twice changes nothing.

## 3. Check it

Run `/trials`, `/recalls`, `/devices` and `/debtors` and compare them with the same lists in Auditdata Manage.

## What maps

| Auditdata Manage | Here |
|---|---|
| Client number | client code `AD-<number>` |
| Name, date of birth, mobile, email, address | client details |
| Clinic, audiologist | the client's clinic and clinician, matched by name |
| Funding or payer (HSP, voucher, ACC, MSD subsidy, Funding Scheme) | the client's funder |
| Referral source, GP | referral source, GP name |
| Status (inactive, deceased) | archived or deceased |
| Appointment type | assessment, fitting, follow-up, review, repair, clean or consult |
| Appointment status (no show, cancelled; past dates attended) | no-show, cancelled, attended, booked |
| Sales line with a serial number or a side | one hearing aid, with product, ear, serial, price, warranty and trial |

Day-first dates (31/12/2026) and ISO dates both work.

## What does not carry over

- **Audiograms.** Hearing test results live in Noah, not in Auditdata Manage's reports. Enter the latest test for each active client with `/test` (four thresholds per ear), or ask Enterprise DNA to bring the Noah records across.
- **Vouchers, approvals and claims.** Add current HSP vouchers with `/voucher` and open claims with `/claim`. Paid claims stay in the funder's portal.
- **Invoices and payments.** Bring opening balances across with `/invoice` per client who owes money. Your accounting system stays the record of payments.
- **Batteries and services on the sales report.** Lines with no serial number and no side are skipped.
- **Documents and letters.** Download any you need from Auditdata Manage before the subscription ends.
