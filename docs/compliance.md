# Record checks for hearing clinics

This system checks your own records against the rules below and lists what is missing, late or out of line. It does not replace your Hearing Services Program contract, your funder's guidelines or your clinician's judgement, and it is not legal advice. Every number a rule uses lives in the `settings` table: change it with `/setting` when the source changes, and update this page in the same change.

Run `/compliance` (or `npm run clinic -- compliance`) for the findings. Each rule name below is the `rule` column in that output.

Sources read on 3 November 2026.

## Australia: Hearing Services Program

The program rules for providers are in the [Hearing Services Program Schedule of Service Items and Fees 2026-27](https://www.legislation.gov.au/F2026N00686/asmade/2026-07-01/text/original/pdf) (in force from 1 July 2026), with guidance on [service and device requirements](https://www.health.gov.au/our-work/hearing-services-program/providing-services/service-device-requirements), [claiming](https://www.health.gov.au/our-work/hearing-services-program/providing-services/claiming) and [eligibility](https://www.health.gov.au/our-work/hearing-services-program/accessing/eligibility).

### HSP-VOUCHER

- **Rule:** an HSP service is delivered under a current voucher. "Vouchers are valid for 5 years from the date of issue" ([eligibility](https://www.health.gov.au/our-work/hearing-services-program/accessing/eligibility)).
- **Breach in the data:** a device with funder `hsp` fitted on a day no voucher for that client covers.
- **Also:** `tomorrow` flags an HSP assessment or fitting with no current voucher, and `attention` lists vouchers ending in 60 days.

### HSP-REPLACEMENT

- **Rule:** a refitting needs "no fittings have been claimed within the last five (5) years for the ear proposed for refitting" (Schedule s16), unless another refitting criterion applies, such as changed hearing. A device lost or damaged beyond repair can be replaced at any time with a current voucher, with a statutory declaration or the supplier's letter (items 840 and 850).
- **Breach in the data:** a new HSP device for an ear that had an HSP device kept inside `hsp_replacement_years` (5), where the earlier device's reason does not say lost or damaged.
- **What to do:** check whether another criterion applies (for example the hearing changed: see `/changed`), and record why on the client file.

### HSP-CLAIM-6-MONTHS

- **Rule:** "The Commonwealth is not required to pay a Service Provider if a claim was submitted six (6) months or more after the Date of Service" (Schedule s5(2)(o)).
- **Breach in the data:** an HSP claim not lodged, or lodged, six months or more after its service date.

### Signed quote before fitting (CONSENT-BEFORE-FIT)

- **Rule:** before any fitting, replacement or spare, the client (or their power of attorney or guardian) "must sign and date the device quote on the day it is received" (Schedule s7(1)). The quote states the warranty period and the provider's returns policy. `npm run docs -- device-quote` renders it.
- **Breach in the data:** a hearing aid fitted with no `consent_on` date on the client, or a date after the fitting. Applied to every funder as a house rule.

### Follow-up after fitting (FOLLOW-UP-AFTER-FIT)

- **Rule:** an HSP fitting is at least two appointments, and "the follow up must occur at least seven calendar days after the fitting" (Schedule s44(4) and (5)). The fitting is not claimed until the fitting is successful and the client has accepted the device (s43(8)), and the date of service is the follow-up date.
- **Breach in the data:** a hearing aid fitted more than `follow_up_days` (14, a house setting) ago with no follow-up or review attended since. Book HSP follow-ups at least 7 days after the fitting.

### Records

- **Rule:** client records must "be accessible for 7 years from the date of the most recent interaction with the client" (Schedule s21(1)(b)), in an accessible format such as PDF (s21(3)). State health records law sets the same period for adults in [NSW](https://www.ipc.nsw.gov.au/media/3535) (Health Records and Information Privacy Act 2002 s25: 7 years from the last service, or until 25 for information collected under 18).
- **In the data:** `/retention` shows each client's last service and keep-until date (`retention_years_au`, 7). Nothing is ever deleted by a command.

### Maintenance

- Providers offer an annual maintenance agreement, claimable once every 12 months and not before 12 months after fitting (Schedule s55 and s56). Raise it as a claim with `/claim`.

## New Zealand

### NZ-FUNDING-INTERVAL

- **MSD Hearing Aid Subsidy:** $511.11 including GST per hearing aid, for adults over 16 with permanent hearing loss not covered by the Funding Scheme, "no more than once every six years" ([guide to the subsidy](https://www.disabilitysupport.govt.nz/disabled-people/support-and-services/equipment-and-aids/deaf-or-hearing-loss-equipment-for-adults/guide-to-hearing-aids-subsidy)). The audiologist deducts the subsidy and claims it at the end of the trial.
- **Hearing Aid Funding Scheme:** adults once every 6 years per ear; only full NZAS members can apply ([guide to the scheme](https://www.disabilitysupport.govt.nz/disabled-people/support-and-services/equipment-and-aids/deaf-or-hearing-loss-equipment-for-adults/guide-to-the-hearing-aid-funding-scheme)).
- **ACC:** assessments, consultations and devices for hearing loss are payable "at intervals of at least 6 years" ([Accident Compensation (Apportioning Entitlements for Hearing Loss) Regulations 2010](https://www.legislation.govt.nz/secondary-legislation/pco-drafted/2010/424/en/latest/), regs 5 to 8).
- **Breach in the data:** a funded aid (`msd`, `hafs` or `acc`) for an ear that had a device from the same funder inside `nz_funding_years` (6).

### FUNDER-APPROVAL

- **Rule:** under the 2010 Regulations the claimant must have ACC's prior approval before device consultations, devices and fittings, and devices are fitted for "a trial period of at least 2 weeks". The Funding Scheme is applied for before the aids are supplied.
- **Breach in the data:** a device with funder `acc` or `hafs` fitted with no approval from that funder dated on or before the fitting. `fit` refuses it, and `tomorrow` flags the fitting appointment.

### Records

- **Rule:** health information is kept for at least "10 years beginning on the day after the date shown in the health information as the most recent date on which a provider provided services" ([Health (Retention of Health Information) Regulations 1996](https://www.legislation.govt.nz/secondary-legislation/pco-drafted/1996/343/en/latest/), regs 5 and 6). The [NZAS Code of Ethics](https://audiology.org.nz/assets/Uploads/Governance/Code-of-Ethics-11-Dec-2014-reformatted-Aug-2019.pdf) 1.12 requires adequate records of all services and products dispensed.
- **In the data:** `/retention` with `retention_years_nz` (10).

## House rules (both countries)

These are good practice the clinic sets for itself. Each number is a setting.

- **TEST-BEFORE-FIT:** a hearing aid fitted with no hearing test in the `test_valid_months` (12) before it.
- **TRIAL-UNDECIDED:** a trial past its end date still not marked kept or returned. The trial length is `trial_days` (30); ACC trials are at least 2 weeks.
- **CLAIM-NOT-LODGED:** a funder claim not lodged within `claim_lodge_days` (30) of the service. Separate from the HSP six-month limit, so claims never get near it.
- **REGISTRATION:** an active clinician whose professional membership or registration has expired, and any appointment they attended after it expired. Record the date the membership runs out as `registration_expiry`.
