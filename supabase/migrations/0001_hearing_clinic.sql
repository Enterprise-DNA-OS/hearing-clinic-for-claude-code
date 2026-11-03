-- Hearing Clinic for Claude Code: the records an independent hearing clinic runs on.
-- Clinics, clinicians, clients, hearing tests, the appointment book, hearing aids with
-- their serials, trials and warranties, repairs at the manufacturer, funder vouchers and
-- approvals, claims, invoices and payments. Plain SQL: any Postgres or the embedded PGlite.
--
-- Thresholds are dB HL at 500, 1000, 2000 and 4000 Hz, left and right.
-- Money is in the clinic's own currency, two decimals.
-- Funders: private, hsp (AU Hearing Services Program), msd (NZ MSD Hearing Aid Subsidy),
-- acc (NZ ACC hearing loss cover), hafs (NZ Hearing Aid Funding Scheme).

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- House settings and the limits the funders set. Every one is editable with `setting`.
create table settings (
  key text primary key,
  value numeric not null,
  unit text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clinics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text not null default 'AU' check (country in ('AU','NZ')),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clinicians (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  role text not null default 'audiologist' check (role in ('audiologist','audiometrist','assistant')),
  registration_no text,
  registration_expiry date,
  hsp_qualified boolean not null default false,
  active boolean not null default true,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  dob date,
  phone text,
  email text,
  address text,
  clinic_id uuid references clinics(id),
  clinician_id uuid references clinicians(id),
  funder text not null default 'private' check (funder in ('private','hsp','msd','acc','hafs')),
  referral_source text,
  gp_name text,
  consent_on date,
  status text not null default 'active' check (status in ('active','archived','deceased')),
  created_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AU Hearing Services Program vouchers. A client may hold several over the years.
create table vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id) on delete cascade,
  issued_on date not null,
  expires_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on > issued_on)
);

-- Funder approvals that must be in place before a fitting (ACC, the Hearing Aid Funding Scheme).
create table approvals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id) on delete cascade,
  funder text not null check (funder in ('acc','hafs','msd','hsp')),
  approved_on date not null,
  amount numeric(10,2),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id) on delete cascade,
  clinician_id uuid references clinicians(id),
  clinic_id uuid references clinics(id),
  on_date date not null,
  starts time not null,
  minutes int not null default 60 check (minutes > 0),
  kind text not null check (kind in ('assessment','fitting','follow-up','review','repair','clean','consult')),
  status text not null default 'booked' check (status in ('booked','attended','no-show','cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per hearing test. Thresholds in dB HL; null where not tested.
create table tests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id) on delete cascade,
  clinician_id uuid references clinicians(id),
  tested_on date not null,
  l500 smallint, l1000 smallint, l2000 smallint, l4000 smallint,
  r500 smallint, r1000 smallint, r2000 smallint, r4000 smallint,
  recommendation text not null default 'review' check (recommendation in ('fit','review','refer','none')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  brand text not null,
  model text not null,
  kind text not null default 'aid' check (kind in ('aid','accessory','charger')),
  tier text,
  price numeric(10,2) not null default 0,
  warranty_months int not null default 36,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A hearing aid or accessory in a client's hands: fitted, on trial, kept, returned.
create table devices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id) on delete cascade,
  product_id uuid not null references products(id),
  ear text not null default '-' check (ear in ('L','R','-')),
  serial text,
  funder text not null default 'private' check (funder in ('private','hsp','msd','acc','hafs')),
  clinician_id uuid references clinicians(id),
  fitted_on date not null,
  trial_ends date,
  outcome text not null default 'trial' check (outcome in ('trial','kept','returned','lost','replaced')),
  decided_on date,
  return_reason text,
  warranty_until date,
  price numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index devices_serial on devices(product_id, serial) where serial is not null;

create table repairs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  device_id uuid not null references devices(id) on delete cascade,
  sent_on date not null,
  sent_to text,
  fault text not null,
  under_warranty boolean not null default false,
  returned_on date,
  cost numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Claims to a funder: lodged, then paid.
create table claims (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id) on delete cascade,
  device_id uuid references devices(id),
  funder text not null check (funder in ('hsp','msd','acc','hafs')),
  item text not null,
  service_on date not null,
  amount numeric(10,2) not null check (amount >= 0),
  lodged_on date,
  paid_on date,
  ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What the client (or someone paying for them) owes.
create table invoices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients(id) on delete cascade,
  issued_on date not null,
  due_on date not null,
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  paid_on date not null,
  amount numeric(10,2) not null check (amount > 0),
  ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, paid_on, amount, ref)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['settings','clinics','clinicians','clients','vouchers','approvals','appointments','tests','products','devices','repairs','claims','invoices','payments','notes'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create or replace function setting(k text) returns numeric language sql stable as $$
  select value from settings where key = k
$$;

-- Four-frequency average (500, 1k, 2k, 4k Hz) for one ear. Null if any frequency is missing.
create or replace function fa4(a smallint, b smallint, c smallint, d smallint) returns numeric language sql immutable as $$
  select round((a + b + c + d) / 4.0, 1)
$$;

-- Every test with the averages and the change since the client's previous test.
create view v_tests as
select t.id test_id, t.code, t.client_id, c.code client, c.name, t.tested_on, cl.code clinician,
  fa4(t.l500, t.l1000, t.l2000, t.l4000) left_4fa,
  fa4(t.r500, t.r1000, t.r2000, t.r4000) right_4fa,
  least(fa4(t.l500, t.l1000, t.l2000, t.l4000), fa4(t.r500, t.r1000, t.r2000, t.r4000)) better_4fa,
  t.recommendation,
  greatest(fa4(t.l500, t.l1000, t.l2000, t.l4000) - fa4(p.l500, p.l1000, p.l2000, p.l4000),
           fa4(t.r500, t.r1000, t.r2000, t.r4000) - fa4(p.r500, p.r1000, p.r2000, p.r4000)) worse_by,
  p.tested_on previous_on, t.note
from tests t
join clients c on c.id = t.client_id
left join clinicians cl on cl.id = t.clinician_id
left join lateral (select * from tests x where x.client_id = t.client_id and (x.tested_on, x.code) < (t.tested_on, t.code) order by x.tested_on desc, x.code desc limit 1) p on true;

create view v_devices as
select d.id device_id, d.code, d.client_id, c.code client, c.name, p.code product, p.brand || ' ' || p.model model, p.kind,
  d.ear, d.serial, d.funder, d.fitted_on, d.trial_ends, d.outcome, d.decided_on, d.return_reason, d.warranty_until, d.price,
  round((current_date - d.fitted_on) / 365.25, 1) age_years,
  d.warranty_until - current_date warranty_days,
  case when d.outcome = 'trial' then d.trial_ends - current_date end trial_days_left,
  cl.code clinician,
  exists (select 1 from repairs r where r.device_id = d.id and r.returned_on is null) at_repair
from devices d
join clients c on c.id = d.client_id
join products p on p.id = d.product_id
left join clinicians cl on cl.id = d.clinician_id;

create view v_balances as
select c.id client_id, c.code client, c.name,
  coalesce(sum(i.amount), 0) charged,
  coalesce(sum(pp.paid), 0) paid,
  coalesce(sum(i.amount), 0) - coalesce(sum(pp.paid), 0) owing,
  min(i.due_on) filter (where i.amount > coalesce(pp.paid, 0)) oldest_due
from clients c
join invoices i on i.client_id = c.id
left join lateral (select sum(p.amount) paid from payments p where p.invoice_id = i.id) pp on true
group by c.id;

create view v_clients as
select c.id client_id, c.code, c.name, k.code clinic, cl.code clinician, c.funder, c.status, c.referral_source,
  lt.tested_on last_test, lt.better_4fa,
  (select count(*) from devices d where d.client_id = c.id and d.outcome in ('kept','trial'))::int devices,
  (select min(d.fitted_on) from devices d where d.client_id = c.id and d.outcome = 'kept') oldest_fitted,
  (select max(a.on_date) from appointments a where a.client_id = c.id and a.status = 'attended') last_seen,
  (select min(a.on_date) from appointments a where a.client_id = c.id and a.status = 'booked' and a.on_date >= current_date) next_booked,
  (select max(v.expires_on) from vouchers v where v.client_id = c.id) voucher_expires,
  coalesce(b.owing, 0) owing
from clients c
left join clinics k on k.id = c.clinic_id
left join clinicians cl on cl.id = c.clinician_id
left join lateral (select * from v_tests t where t.client_id = c.id order by t.tested_on desc, t.code desc limit 1) lt on true
left join v_balances b on b.client_id = c.id;

-- The appointment book with everything that should stop an appointment going ahead as planned.
create view v_schedule as
select a.id appointment_id, a.code, a.on_date, a.starts, a.minutes, a.kind, a.status, c.code client, c.name, c.funder,
  cl.code clinician, k.code clinic, a.note,
  concat_ws('; ',
    case when a.kind = 'fitting' and c.consent_on is null then 'no signed consent on file' end,
    case when c.funder = 'hsp' and a.kind in ('assessment','fitting') and not exists (
      select 1 from vouchers v where v.client_id = c.id and a.on_date between v.issued_on and v.expires_on) then 'no current HSP voucher' end,
    case when c.funder in ('acc','hafs') and a.kind = 'fitting' and not exists (
      select 1 from approvals p where p.client_id = c.id and p.funder = c.funder and p.approved_on <= a.on_date) then 'no ' || upper(c.funder) || ' approval yet' end,
    case when a.kind = 'fitting' and not exists (
      select 1 from tests t where t.client_id = c.id and t.tested_on > a.on_date - (setting('test_valid_months') || ' months')::interval) then 'no hearing test in the last ' || setting('test_valid_months') || ' months' end,
    case when cl.registration_expiry < a.on_date then 'clinician registration expired' end,
    case when cl.id is not null and c.funder = 'hsp' and a.kind in ('assessment','fitting') and not cl.hsp_qualified then 'clinician not HSP qualified' end,
    case when exists (select 1 from appointments o where o.id <> a.id and o.clinician_id = a.clinician_id and o.on_date = a.on_date and o.status = 'booked'
      and o.starts < a.starts + make_interval(mins => a.minutes) and a.starts < o.starts + make_interval(mins => o.minutes)) then 'clinician double booked' end,
    case when exists (select 1 from v_balances b where b.client_id = c.id and b.owing > 0 and b.oldest_due < a.on_date - setting('debtor_days')::int) then 'account overdue' end
  ) problems
from appointments a
join clients c on c.id = a.client_id
left join clinicians cl on cl.id = a.clinician_id
left join clinics k on k.id = a.clinic_id;

-- Devices on trial: when each trial ends and whether the follow-up is booked.
create view v_trials as
select d.code, d.client, d.name, d.model, d.ear, d.fitted_on, d.trial_ends, d.trial_days_left, d.clinician, d.price,
  (select min(a.on_date) from appointments a where a.client_id = d.client_id and a.kind = 'follow-up'
     and a.status in ('booked','attended') and a.on_date >= d.fitted_on) follow_up
from v_devices d where d.outcome = 'trial';

-- Clients due their annual review with nothing booked.
create view v_recalls as
select c.code, c.name, c.clinic, c.clinician, c.funder, c.last_test, c.last_seen,
  (c.last_test + (setting('recall_months') || ' months')::interval)::date due_on, c.devices, cl.phone
from v_clients c join clients cl on cl.id = c.client_id
where c.status = 'active' and c.next_booked is null
  and (c.last_test is null or c.last_test < current_date - (setting('recall_months') || ' months')::interval);

-- Clients whose aids are old enough for new ones under their funder's replacement rule.
create view v_upgrades as
select c.code, c.name, c.funder, c.clinician, x.oldest_kept, x.models,
  (x.oldest_kept + (case c.funder when 'hsp' then setting('hsp_replacement_years') when 'msd' then setting('nz_funding_years') when 'acc' then setting('nz_funding_years') when 'hafs' then setting('nz_funding_years') else setting('upgrade_years') end || ' years')::interval)::date eligible_from,
  c.next_booked
from v_clients c
join lateral (select min(d.fitted_on) oldest_kept, max(d.fitted_on) newest_kept, string_agg(distinct d.model, ', ') models
  from v_devices d where d.client_id = c.client_id and d.outcome = 'kept' and d.kind = 'aid') x on x.newest_kept is not null
where c.status = 'active'
  and x.newest_kept < current_date + 90 - (case c.funder when 'hsp' then setting('hsp_replacement_years') when 'msd' then setting('nz_funding_years') when 'acc' then setting('nz_funding_years') when 'hafs' then setting('nz_funding_years') else setting('upgrade_years') end || ' years')::interval;

-- Tested with a loss worth fitting, and no trial since.
create view v_unfitted as
select t.client, t.name, t.code test, t.tested_on, current_date - t.tested_on days_since, t.better_4fa, t.clinician, c.funder, cl.phone,
  (select min(a.on_date) from appointments a where a.client_id = t.client_id and a.status = 'booked' and a.on_date >= current_date) next_booked
from v_tests t
join v_clients c on c.client_id = t.client_id
join clients cl on cl.id = t.client_id
where t.recommendation = 'fit' and c.status = 'active'
  and t.tested_on = c.last_test
  and not exists (select 1 from devices d where d.client_id = t.client_id and d.fitted_on >= t.tested_on);

create view v_repairs as
select r.code, d.client, d.name, d.model, d.serial, r.sent_on, r.sent_to, r.fault, r.under_warranty, r.returned_on, r.cost,
  coalesce(r.returned_on, current_date) - r.sent_on days_out
from repairs r join v_devices d on d.device_id = r.device_id;

create view v_claims as
select k.code, c.code client, c.name, k.funder, k.item, k.service_on, k.amount, k.lodged_on, k.paid_on, k.ref,
  case when k.paid_on is not null then 'paid' when k.lodged_on is not null then 'lodged' else 'not lodged' end state,
  case when k.paid_on is not null then null when k.lodged_on is not null then current_date - k.lodged_on else current_date - k.service_on end days_waiting
from claims k join clients c on c.id = k.client_id;

-- Per clinician over the last 180 days: tests, fit recommendations, trials, kept and returned.
create view v_clinician_results as
select cl.code, cl.name, cl.role,
  (select count(*) from tests t where t.clinician_id = cl.id and t.tested_on > current_date - 180)::int tests,
  (select count(*) from tests t where t.clinician_id = cl.id and t.tested_on > current_date - 180 and t.recommendation = 'fit')::int fit_recommended,
  (select count(*) from devices d where d.clinician_id = cl.id and d.fitted_on > current_date - 180 and d.ear <> '-')::int aids_fitted,
  (select count(*) from devices d where d.clinician_id = cl.id and d.fitted_on > current_date - 180 and d.outcome = 'kept')::int kept,
  (select count(*) from devices d where d.clinician_id = cl.id and d.fitted_on > current_date - 180 and d.outcome = 'returned')::int returned,
  (select coalesce(sum(d.price), 0) from devices d where d.clinician_id = cl.id and d.fitted_on > current_date - 180 and d.outcome = 'kept') kept_value,
  (select count(*) from v_unfitted u where u.clinician = cl.code)::int tested_not_fitted
from clinicians cl where cl.active;

-- Where clients come from, and which sources turn into fittings.
create view v_referrals as
select coalesce(c.referral_source, '(not recorded)') source,
  count(*)::int clients,
  count(*) filter (where exists (select 1 from tests t where t.client_id = c.id))::int tested,
  count(*) filter (where exists (select 1 from devices d where d.client_id = c.id and d.outcome = 'kept'))::int fitted,
  coalesce(sum((select sum(d.price) from devices d where d.client_id = c.id and d.outcome = 'kept')), 0) device_revenue
from clients c group by 1;

-- How long each client's records must be kept: 7 years in AU (HSP Schedule s21, state health
-- records acts), 10 years in NZ (Health (Retention of Health Information) Regulations 1996).
create view v_retention as
select c.code, c.name, c.status, k.country, x.last_service,
  (x.last_service + ((case k.country when 'NZ' then setting('retention_years_nz') else setting('retention_years_au') end) || ' years')::interval)::date keep_until
from clients c
left join clinics k on k.id = c.clinic_id
left join lateral (select greatest(
  (select max(a.on_date) from appointments a where a.client_id = c.id and a.status = 'attended'),
  (select max(t.tested_on) from tests t where t.client_id = c.id),
  (select max(d.fitted_on) from devices d where d.client_id = c.id), c.created_on) last_service) x on true;

-- Every rule in docs/compliance.md, checked against the records.
create view v_compliance as
select 'CONSENT-BEFORE-FIT' rule, d.code record, d.client || ' fitted ' || d.fitted_on || ' with no signed consent on or before that day' issue
from v_devices d join clients c on c.id = d.client_id
where d.kind = 'aid' and (c.consent_on is null or c.consent_on > d.fitted_on)
union all
select 'TEST-BEFORE-FIT', d.code, d.client || ' fitted ' || d.fitted_on || ' with no hearing test in the ' || setting('test_valid_months') || ' months before'
from v_devices d
where d.kind = 'aid' and not exists (select 1 from tests t where t.client_id = d.client_id and t.tested_on <= d.fitted_on
  and t.tested_on > d.fitted_on - (setting('test_valid_months') || ' months')::interval)
union all
select 'HSP-VOUCHER', d.code, d.client || ' fitted under the HSP on ' || d.fitted_on || ' with no voucher current that day'
from v_devices d
where d.funder = 'hsp' and not exists (select 1 from vouchers v where v.client_id = d.client_id and d.fitted_on between v.issued_on and v.expires_on)
union all
select 'HSP-REPLACEMENT', d.code, d.client || ' fitted new ' || d.ear || ' aid under the HSP ' || d.fitted_on || ', ' || p.fitted_on || ' fitting is inside ' || setting('hsp_replacement_years') || ' years'
from v_devices d join devices p on p.client_id = d.client_id and p.ear = d.ear and p.id <> d.device_id and p.funder = 'hsp' and p.outcome in ('kept','replaced')
  and coalesce(p.return_reason, '') !~* '(lost|damaged|beyond repair)'
where d.funder = 'hsp' and d.outcome in ('trial','kept') and p.fitted_on < d.fitted_on
  and p.fitted_on > d.fitted_on - (setting('hsp_replacement_years') || ' years')::interval
union all
select 'NZ-FUNDING-INTERVAL', d.code, d.client || ' ' || upper(d.funder) || ' funded fitting ' || d.fitted_on || ', previous funded ' || d.ear || ' aid ' || p.fitted_on || ' is inside ' || setting('nz_funding_years') || ' years'
from v_devices d join devices p on p.client_id = d.client_id and p.ear = d.ear and p.id <> d.device_id and p.funder = d.funder and p.outcome in ('kept','replaced')
where d.funder in ('msd','acc','hafs') and d.outcome in ('trial','kept') and p.fitted_on < d.fitted_on
  and p.fitted_on > d.fitted_on - (setting('nz_funding_years') || ' years')::interval
union all
select 'FUNDER-APPROVAL', d.code, d.client || ' fitted ' || d.fitted_on || ' under ' || upper(d.funder) || ' with no approval on file before the fitting'
from v_devices d
where d.funder in ('acc','hafs') and not exists (select 1 from approvals p where p.client_id = d.client_id and p.funder = d.funder and p.approved_on <= d.fitted_on)
union all
select 'FOLLOW-UP-AFTER-FIT', d.code, d.client || ' fitted ' || d.fitted_on || ', no follow-up attended in ' || (current_date - d.fitted_on) || ' days'
from v_devices d
where d.kind = 'aid' and d.outcome in ('trial','kept') and d.fitted_on < current_date - setting('follow_up_days')::int
  and d.fitted_on > current_date - 365
  and not exists (select 1 from appointments a where a.client_id = d.client_id and a.kind in ('follow-up','review') and a.status = 'attended' and a.on_date > d.fitted_on)
union all
select 'TRIAL-UNDECIDED', d.code, d.client || ' trial ended ' || d.trial_ends || ', still not marked kept or returned'
from v_devices d where d.outcome = 'trial' and d.trial_ends < current_date
union all
select 'CLAIM-NOT-LODGED', k.code, k.name || ' ' || upper(k.funder) || ' ' || k.item || ' on ' || k.service_on || ', not lodged after ' || k.days_waiting || ' days'
from v_claims k where k.state = 'not lodged' and k.days_waiting > setting('claim_lodge_days')
union all
select 'HSP-CLAIM-6-MONTHS', k.code, k.name || ' HSP ' || k.item || ' on ' || k.service_on || case when k.lodged_on is null then ', still not lodged' else ', lodged ' || k.lodged_on end || ': six months or more after the service'
from v_claims k where k.funder = 'hsp' and coalesce(k.lodged_on, current_date) >= (k.service_on + interval '6 months')::date
union all
select 'REGISTRATION', a.clinician || ' ' || a.on_date, a.clinician || ' saw ' || a.client || ' on ' || a.on_date || ' with registration expired ' || cl.registration_expiry
from v_schedule a join clinicians cl on cl.code = a.clinician
where a.status = 'attended' and cl.registration_expiry < a.on_date
union all
select 'REGISTRATION', cl.code, cl.name || ' registration expired ' || cl.registration_expiry
from clinicians cl where cl.active and cl.registration_expiry < current_date;

-- What needs chasing, in one list.
create view v_attention as
select 'appointment with a problem' kind, s.code record, s.on_date due, s.client || ' ' || s.kind || ': ' || s.problems detail
from v_schedule s where s.status = 'booked' and s.on_date between current_date and current_date + 7 and s.problems <> ''
union all
select 'trial ending, no follow-up', t.code, t.trial_ends, t.client || ' ' || t.model || ' ' || t.ear
from v_trials t where t.trial_days_left between 0 and 7 and t.follow_up is null
union all
select 'trial overdue', t.code, t.trial_ends, t.client || ' ' || t.model || ': mark kept or returned'
from v_trials t where t.trial_days_left < 0
union all
select 'tested, not fitted', u.client, u.tested_on, u.name || ', better ear ' || u.better_4fa || ' dB, ' || u.days_since || ' days ago'
from v_unfitted u where u.days_since >= setting('unfitted_days') and u.next_booked is null
union all
select 'review due', r.code, r.due_on, r.name || ', last test ' || coalesce(r.last_test::text, 'never')
from v_recalls r
union all
select 'repair away too long', r.code, r.sent_on, r.client || ' ' || r.model || ' at ' || coalesce(r.sent_to, 'the manufacturer') || ' for ' || r.days_out || ' days'
from v_repairs r where r.returned_on is null and r.days_out > setting('repair_days')
union all
select 'claim not lodged', k.code, k.service_on, k.name || ' ' || upper(k.funder) || ' ' || k.amount
from v_claims k where k.state = 'not lodged' and k.days_waiting > setting('claim_lodge_days')
union all
select 'claim unpaid', k.code, k.lodged_on, k.name || ' ' || upper(k.funder) || ' ' || k.amount || ', ' || k.days_waiting || ' days'
from v_claims k where k.state = 'lodged' and k.days_waiting > setting('claim_paid_days')
union all
select 'account overdue', b.client, b.oldest_due, b.name || ' owes ' || b.owing
from v_balances b where b.owing > 0 and b.oldest_due < current_date - setting('debtor_days')::int
union all
select 'eligible for new aids', u.code, u.eligible_from, u.name || ', ' || u.models || ' fitted ' || u.oldest_kept
from v_upgrades u where u.next_booked is null
union all
select 'warranty ending', d.code, d.warranty_until, d.client || ' ' || d.model || ' ' || d.ear
from v_devices d where d.outcome = 'kept' and d.warranty_days between 0 and 60
union all
select 'voucher expiring', c.code, c.voucher_expires, c.name || ': HSP voucher'
from v_clients c where c.status = 'active' and c.funder = 'hsp' and c.voucher_expires between current_date and current_date + 60
union all
select 'no-show not rebooked', s.code, s.on_date, s.client || ' ' || s.kind
from v_schedule s join clients c on c.code = s.client
where s.status = 'no-show' and s.on_date > current_date - 30
  and not exists (select 1 from appointments a where a.client_id = c.id and a.status = 'booked' and a.on_date >= current_date)
union all
select 'registration due', cl.code, cl.registration_expiry, cl.name
from clinicians cl where cl.active and cl.registration_expiry < current_date + 60;
