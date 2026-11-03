#!/usr/bin/env node
// The one CLI for Hearing Clinic for Claude Code. Human tables by default, --json for machines.
//   npm run clinic -- help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, pick } from './lib/csv.mjs';

// Every read the front desk, the clinicians and the owner ask for, by name.
export const reads = {
  settings: 'select key,value,unit,note from settings order by key',
  clinics: 'select code,name,country,address from clinics order by code',
  clinicians: 'select code,name,role,registration_no,registration_expiry,hsp_qualified,active from clinicians order by code',
  products: 'select code,brand,model,kind,tier,price,warranty_months,active from products order by kind,price desc,code',
  clients: 'select code,name,clinic,clinician,funder,status,last_test,better_4fa,devices,last_seen,next_booked,owing from v_clients order by code',
  schedule: "select code,on_date,starts,minutes,kind,client,name,clinician,clinic,problems from v_schedule where status='booked' and on_date>=current_date order by on_date,starts,code",
  today: "select code,starts,minutes,kind,client,name,clinician,clinic,problems from v_schedule where status='booked' and on_date=current_date order by starts,code",
  tomorrow: "select code,starts,minutes,kind,client,name,clinician,clinic,problems from v_schedule where status='booked' and on_date=current_date+1 order by starts,code",
  tests: 'select code,client,name,tested_on,clinician,left_4fa,right_4fa,better_4fa,worse_by,recommendation from v_tests order by tested_on desc,code',
  changed: 'select client,name,tested_on,previous_on,left_4fa,right_4fa,worse_by,clinician from v_tests where worse_by>=10 order by tested_on desc',
  devices: "select code,client,model,ear,serial,funder,fitted_on,outcome,age_years,warranty_until,at_repair from v_devices where outcome in ('trial','kept') order by client,code",
  trials: 'select code,client,name,model,ear,fitted_on,trial_ends,trial_days_left,follow_up,clinician,price from v_trials order by trial_ends,code',
  returns: "select code,client,model,ear,clinician,fitted_on,decided_on,return_reason,price from v_devices where outcome='returned' order by decided_on desc,code",
  unfitted: 'select client,name,tested_on,days_since,better_4fa,clinician,funder,phone,next_booked from v_unfitted order by days_since desc',
  recalls: 'select code,name,clinic,clinician,funder,last_test,due_on,last_seen,devices,phone from v_recalls order by due_on nulls first,code',
  upgrades: 'select code,name,funder,clinician,models,oldest_kept,eligible_from,next_booked from v_upgrades order by eligible_from,code',
  warranties: "select code,client,model,ear,serial,fitted_on,warranty_until,warranty_days from v_devices where outcome='kept' and warranty_days between -30 and 90 order by warranty_until",
  repairs: 'select code,client,model,serial,sent_on,sent_to,fault,under_warranty,returned_on,days_out,cost from v_repairs order by returned_on nulls first,sent_on',
  vouchers: 'select v.code,c.code client,c.name,v.issued_on,v.expires_on,v.expires_on-current_date days_left from vouchers v join clients c on c.id=v.client_id order by v.expires_on desc',
  claims: "select code,client,name,funder,item,service_on,amount,state,lodged_on,paid_on,days_waiting,ref from v_claims order by state='paid',service_on,code",
  debtors: 'select client,name,charged,paid,owing,oldest_due,current_date-oldest_due days_overdue from v_balances where owing>0 order by oldest_due',
  results: 'select code,name,role,tests,fit_recommended,aids_fitted,kept,returned,kept_value,tested_not_fitted from v_clinician_results order by kept_value desc',
  referrals: 'select source,clients,tested,fitted,device_revenue from v_referrals order by device_revenue desc,clients desc',
  takings: "select to_char(date_trunc('month',paid_on),'YYYY-MM') as month,count(*)::int payments,sum(amount) received from payments where paid_on>current_date-365 group by 1 order by 1 desc",
  retention: "select code,name,status,country,last_service,keep_until,case when keep_until<current_date then 'may be destroyed' else 'keep' end state from v_retention where status<>'active' or keep_until<current_date+365 order by keep_until",
  compliance: 'select rule,record,issue from v_compliance order by rule,record',
  attention: 'select kind,record,due,detail from v_attention order by due nulls last,kind,record',
};

const named = {
  clinics: { by: 'code', names: true }, clinicians: { by: 'code', names: true }, clients: { by: 'code', names: true },
  products: { by: 'code', names: 'model' }, appointments: { by: 'code' }, devices: { by: 'code', names: 'serial' },
  repairs: { by: 'code' }, claims: { by: 'code' }, invoices: { by: 'code' }, tests: { by: 'code' },
};

// Exact code or id first, then a unique prefix or name match. Ambiguity lists candidates.
export async function resolve(db, entity, value) {
  const label = entity.replace(/s$/, '');
  if (!value || value === true) throw Error(`Supply a ${label} code, name or id prefix`);
  const { by, names } = named[entity];
  const nameCol = names === true ? 'name' : names;
  const exact = await db.query(`select * from ${entity} where lower(${by})=lower($1) or id::text=$1${nameCol ? ` or lower(${nameCol})=lower($1)` : ''}`, [String(value)]);
  if (exact.length === 1) return exact[0];
  const found = await db.query(`select * from ${entity} where starts_with(lower(${by}),lower($1)) or starts_with(id::text,$1)${nameCol ? ` or position(lower($1) in lower(${nameCol}))>0` : ''} order by ${by}`, [String(value)]);
  if (found.length === 1) return found[0];
  const list = found.map((r) => `${r[by]}${nameCol && r[nameCol] ? ' ' + r[nameCol] : ''}`).join('; ') || '(none)';
  throw Error(`${found.length ? 'Ambiguous' : 'No matching'} ${label}: ${value}. Candidates: ${list}`);
}

const required = (v, n) => { if (v === undefined || v === null || v === true || String(v).trim() === '') throw Error(`Required: ${n}`); return String(v).trim(); };
const number = (v, n, { positive = false, min, max } = {}) => {
  const x = Number(required(v, n));
  if (!Number.isFinite(x) || (positive && x <= 0) || (min !== undefined && x < min) || (max !== undefined && x > max)) throw Error(`Invalid ${n}: ${v}`);
  return x;
};
const date = (v, n = 'date') => {
  required(v, n);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error(`Invalid ${n}: use a real YYYY-MM-DD date`);
  return v;
};
const time = (v, n) => {
  const s = required(v, `${n} (HH:MM)`);
  if (!/^\d{2}:\d{2}$/.test(s) || Number(s.slice(0, 2)) > 23 || Number(s.slice(3)) > 59) throw Error(`Invalid ${n}: ${s}. Use HH:MM`);
  return s;
};
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const ymd = (d) => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10);
const funders = ['private', 'hsp', 'msd', 'acc', 'hafs'];
const kinds = ['assessment', 'fitting', 'follow-up', 'review', 'repair', 'clean', 'consult'];
const oneOf = (v, list, n) => { const s = required(v, n).toLowerCase(); if (!list.includes(s)) throw Error(`Invalid ${n}: ${v}. Use ${list.join(', ')}`); return s; };
// "35,40,55,65" -> four thresholds at 500, 1k, 2k and 4k Hz.
const thresholds = (v, n) => {
  const parts = required(v, `${n} (four thresholds at 500,1000,2000,4000 Hz, for example 35,40,55,65)`).split(/[,/ ]+/).filter(Boolean);
  if (parts.length !== 4) throw Error(`Invalid ${n}: give four thresholds at 500,1000,2000,4000 Hz`);
  return parts.map((p) => { if (p === '-' || p.toLowerCase() === 'nr') return null; return number(p, `${n} threshold`, { min: -10, max: 120 }); });
};
const setting = async (db, key) => Number((await db.query('select value from settings where key=$1', [key]))[0]?.value);

async function transaction(db, fn, dry = false) {
  await db.exec('begin');
  try { const out = await fn(); await db.exec(dry ? 'rollback' : 'commit'); return out; }
  catch (e) { await db.exec('rollback'); throw e; }
}

async function nextCode(db, tbl, prefix, start) {
  const r = await db.query(`select greatest(max(substring(code from ${prefix.length + 1})::int),$2) n from ${tbl} where code ~ $1`, [`^${prefix}[0-9]+$`, start]);
  return `${prefix}${Number(r[0].n) + 1}`;
}

const entities = ['settings', 'clinics', 'clinicians', 'clients', 'vouchers', 'approvals', 'appointments', 'tests', 'products', 'devices', 'repairs', 'claims', 'invoices', 'payments', 'notes'];

export const help = [
  ...Object.keys(reads),
  'client <code|name>', 'clinician <code|name>',
  'add clinic <code> <name> [--country=AU|NZ] [--address=..]',
  'add clinician <code> <name> [--role=audiologist|audiometrist|assistant] [--registration=no] [--expires=YYYY-MM-DD] [--hsp]',
  'add client <name> [--code=C1234] [--dob=YYYY-MM-DD] [--phone=..] [--email=..] [--clinic=..] [--clinician=..] [--funder=private|hsp|msd|acc|hafs] [--referral=..] [--gp=..]',
  'add product <code> --brand=.. --model=.. [--kind=aid|accessory|charger] [--tier=..] [--price=..] [--warranty-months=36]',
  'book <client> --date=YYYY-MM-DD --start=HH:MM --kind=assessment|fitting|follow-up|review|repair|clean|consult [--minutes=60] [--clinician=..] [--clinic=..] [--force]',
  'attend <appointment>', 'no-show <appointment>', 'cancel <appointment> [--note=..]',
  'test <client> --left=35,40,55,65 --right=30,40,50,60 [--recommend=fit|review|refer|none] [--date=..] [--clinician=..] [--note=..]',
  'fit <client> --product=.. --ears=L,R|L|R|- [--serials=A,B] [--funder=..] [--price=each] [--trial-days=30] [--date=..] [--clinician=..] [--force]',
  'keep <device|client>', 'return <device|client> --reason=".." [--date=..]',
  'repair <device> --fault=".." [--to=..] [--warranty] [--date=..]', 'repaired <repair> [--cost=..] [--date=..]',
  'consent <client> [--date=..]', 'voucher <client> <number> --issued=YYYY-MM-DD --expires=YYYY-MM-DD',
  'approval <client> <ref> --funder=acc|hafs|msd|hsp [--date=..] [--amount=..]',
  'claim <client> --funder=hsp|msd|acc|hafs --item=".." --amount=.. [--date=..] [--device=..]', 'lodge <claim> [--ref=..] [--date=..]', 'claim-paid <claim> [--date=..]',
  'invoice <client> <amount> --description=".." [--date=..] [--due-days=14]', 'pay <invoice|client> <amount> --ref=.. [--date=..]',
  'status <client> active|archived|deceased', 'setting <key> <value>', 'log <client> <note>',
  'import auditdata <folder> [--dry-run] [--map=file.json]', 'export <folder>',
  'draft-recall <client>', 'draft-trial-check <client>', 'draft-gp-letter <client>', 'draft-upgrade <client>', 'draft-statement <client>',
];

export async function run(db, args) {
  const flags = {}; const pos = [];
  for (const a of args) {
    if (a.startsWith('--')) { const i = a.indexOf('='); flags[a.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : a.slice(i + 1); }
    else pos.push(a);
  }
  const [cmd = 'help', ...a] = pos;
  if (cmd === 'help') return help.map((command) => ({ command }));
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'client') {
    const c = await resolve(db, 'clients', a.join(' ') || undefined);
    return {
      client: await db.query('select v.code,v.name,cl.dob,cl.phone,cl.email,v.clinic,v.clinician,v.funder,v.status,v.referral_source,cl.gp_name,cl.consent_on,v.last_test,v.last_seen,v.next_booked,v.voucher_expires,v.owing from v_clients v join clients cl on cl.id=v.client_id where v.client_id=$1', [c.id]),
      tests: await db.query('select code,tested_on,clinician,left_4fa,right_4fa,worse_by,recommendation,note from v_tests where client_id=$1 order by tested_on desc', [c.id]),
      devices: await db.query('select code,model,ear,serial,funder,fitted_on,trial_ends,outcome,warranty_until,at_repair from v_devices where client_id=$1 order by fitted_on desc,code', [c.id]),
      appointments: await db.query('select code,on_date,starts,kind,status,clinician,problems from v_schedule where client=$1 order by on_date desc,starts limit 12', [c.code]),
      claims: await db.query('select code,funder,item,service_on,amount,state from v_claims where client=$1 order by service_on desc', [c.code]),
      funding: await db.query("select 'voucher' kind,code ref,issued_on on_date,expires_on until from vouchers where client_id=$1 union all select funder||' approval',code,approved_on,null from approvals where client_id=$1 order by 3 desc", [c.id]),
      notes: await db.query('select created_at,body from notes where client_id=$1 order by created_at', [c.id]),
    };
  }
  if (cmd === 'clinician') {
    const c = await resolve(db, 'clinicians', a.join(' ') || undefined);
    return {
      clinician: await db.query('select code,name,role,registration_no,registration_expiry,hsp_qualified,active from clinicians where id=$1', [c.id]),
      results: await db.query('select tests,fit_recommended,aids_fitted,kept,returned,kept_value,tested_not_fitted from v_clinician_results where code=$1', [c.code]),
      booked: await db.query("select code,on_date,starts,kind,client,name,problems from v_schedule where clinician=$1 and status='booked' and on_date>=current_date order by on_date,starts", [c.code]),
      trials: await db.query('select code,client,model,ear,trial_ends,follow_up from v_trials where clinician=$1 order by trial_ends', [c.code]),
      tested_not_fitted: await db.query('select client,name,tested_on,better_4fa from v_unfitted where clinician=$1 order by tested_on', [c.code]),
    };
  }

  if (cmd === 'export') {
    const dir = path.resolve(required(a[0], 'export folder'));
    fs.mkdirSync(dir, { recursive: true });
    return transaction(db, async () => {
      await db.exec('set transaction isolation level repeatable read');
      const counts = [];
      for (const t of entities) {
        const rows = await db.query(`select * from ${t} order by ${t === 'settings' ? 'key' : 'id'}`);
        fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 2) + '\n');
        counts.push({ entity: t, rows: rows.length });
      }
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, at: new Date().toISOString(), counts }, null, 2) + '\n');
      return counts;
    });
  }

  if (cmd === 'import') return importAuditdata(db, a, flags);
  if (cmd === 'add') return transaction(db, () => add(db, a, flags));

  if (cmd === 'book') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a.join(' ') || undefined);
    if (c.status !== 'active') throw Error(`${c.code} is ${c.status}: set them active before booking`);
    const kind = oneOf(flags.kind, kinds, 'kind (--kind)');
    const day = date(flags.date);
    if (day < today()) throw Error(`${day} is in the past`);
    const cl = flags.clinician ? await resolve(db, 'clinicians', flags.clinician) : c.clinician_id ? { id: c.clinician_id } : null;
    const k = flags.clinic ? await resolve(db, 'clinics', flags.clinic) : c.clinic_id ? { id: c.clinic_id } : null;
    const code = await nextCode(db, 'appointments', 'A', 3000);
    await db.query('insert into appointments(code,client_id,clinician_id,clinic_id,on_date,starts,minutes,kind,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [code, c.id, cl?.id || null, k?.id || null, day, time(flags.start, 'start'), flags.minutes ? number(flags.minutes, 'minutes', { positive: true }) : 60, kind, flags.note || null]);
    const row = await db.query('select code,on_date,starts,minutes,kind,client,name,clinician,clinic,problems from v_schedule where code=$1', [code]);
    if (row[0].problems && !flags.force) throw Error(`Not booked: ${row[0].problems}. Fix these, or add --force once the clinic manager has said yes`);
    return row;
  });

  if (['attend', 'no-show', 'cancel'].includes(cmd)) return transaction(db, async () => {
    const ap = await resolve(db, 'appointments', a[0]);
    if (ap.status !== 'booked') throw Error(`Appointment ${ap.code} is ${ap.status}: cannot ${cmd}`);
    if (cmd === 'attend' && ymd(ap.on_date) > today()) throw Error(`Appointment ${ap.code} is on ${ymd(ap.on_date)}: it has not happened yet`);
    const status = { attend: 'attended', 'no-show': 'no-show', cancel: 'cancelled' }[cmd];
    return db.query('update appointments set status=$2,note=coalesce($3,note) where id=$1 returning code,on_date,kind,status', [ap.id, status, flags.note || null]);
  });

  if (cmd === 'test') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a.join(' ') || undefined);
    const [l1, l2, l3, l4] = thresholds(flags.left, '--left');
    const [r1, r2, r3, r4] = thresholds(flags.right, '--right');
    const cl = flags.clinician ? await resolve(db, 'clinicians', flags.clinician) : c.clinician_id ? { id: c.clinician_id } : null;
    const rec = flags.recommend ? oneOf(flags.recommend, ['fit', 'review', 'refer', 'none'], 'recommendation (--recommend)') : 'review';
    const code = await nextCode(db, 'tests', 'T', 6000);
    await db.query('insert into tests(code,client_id,clinician_id,tested_on,l500,l1000,l2000,l4000,r500,r1000,r2000,r4000,recommendation,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [code, c.id, cl?.id || null, flags.date ? date(flags.date) : today(), l1, l2, l3, l4, r1, r2, r3, r4, rec, flags.note || null]);
    return db.query('select code,client,tested_on,left_4fa,right_4fa,better_4fa,worse_by,recommendation from v_tests where code=$1', [code]);
  });

  if (cmd === 'fit') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a.join(' ') || undefined);
    const p = await resolve(db, 'products', flags.product);
    const ears = String(required(flags.ears, 'ears (--ears=L,R or L or R, - for an accessory)')).toUpperCase().split(',').map((e) => e.trim());
    if (!ears.every((e) => ['L', 'R', '-'].includes(e)) || new Set(ears).size !== ears.length) throw Error(`Invalid --ears: ${flags.ears}`);
    const serials = flags.serials ? String(flags.serials).split(',').map((s) => s.trim()) : [];
    if (serials.length && serials.length !== ears.length) throw Error('Give one serial per ear, in the same order as --ears');
    const funder = flags.funder ? oneOf(flags.funder, funders, 'funder') : c.funder;
    const day = flags.date ? date(flags.date) : today();
    const trial = flags['trial-days'] ? number(flags['trial-days'], 'trial days', { min: 0 }) : await setting(db, 'trial_days');
    const cl = flags.clinician ? await resolve(db, 'clinicians', flags.clinician) : c.clinician_id ? { id: c.clinician_id } : null;
    const price = flags.price !== undefined ? number(flags.price, 'price', { min: 0 }) : Number(p.price);
    const out = [];
    for (const [i, ear] of ears.entries()) {
      const code = await nextCode(db, 'devices', 'D', 4000);
      await db.query("insert into devices(code,client_id,product_id,ear,serial,funder,clinician_id,fitted_on,trial_ends,outcome,warranty_until,price) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,($8::date+make_interval(months=>$11))::date,$12)",
        [code, c.id, p.id, ear, serials[i] || null, funder, cl?.id || null, day, p.kind === 'aid' ? addDays(day, trial) : null, p.kind === 'aid' ? 'trial' : 'kept', p.warranty_months, price]);
      out.push(code);
    }
    const problems = await db.query('select rule,issue from v_compliance where record = any($1)', [out]);
    if (problems.length && !flags.force) throw Error(`Not fitted: ${problems.map((r) => `${r.rule}: ${r.issue}`).join('; ')}. Fix these, or add --force once the clinic manager has said yes`);
    return db.query('select code,client,model,ear,serial,funder,fitted_on,trial_ends,outcome,warranty_until,price from v_devices where code = any($1) order by code', [out]);
  });

  if (cmd === 'keep' || cmd === 'return') return transaction(db, async () => {
    const ref = a.join(' ');
    let ids;
    const dev = (await db.query("select id from devices where lower(code)=lower($1) or lower(serial)=lower($1)", [ref]))[0];
    if (dev) ids = [dev.id];
    else {
      const c = await resolve(db, 'clients', ref || undefined);
      ids = (await db.query("select id from devices where client_id=$1 and outcome='trial'", [c.id])).map((r) => r.id);
      if (!ids.length) throw Error(`${c.code} has nothing on trial`);
    }
    const rows = await db.query('select code,outcome from devices where id = any($1)', [ids]);
    const bad = rows.filter((r) => r.outcome !== 'trial' && !(cmd === 'return' && r.outcome === 'kept'));
    if (bad.length) throw Error(`${bad.map((r) => `${r.code} is ${r.outcome}`).join('; ')}: only a device on trial (or kept, for a return) can change`);
    if (cmd === 'keep') return db.query("update devices set outcome='kept',decided_on=current_date where id = any($1) returning code,ear,outcome,decided_on", [ids]);
    return db.query("update devices set outcome='returned',decided_on=$2,return_reason=$3 where id = any($1) returning code,ear,outcome,decided_on,return_reason",
      [ids, flags.date ? date(flags.date) : today(), required(flags.reason, 'reason (--reason)')]);
  });

  if (cmd === 'repair') return transaction(db, async () => {
    const d = await resolve(db, 'devices', a[0]);
    const code = await nextCode(db, 'repairs', 'R', 8000);
    return db.query('insert into repairs(code,device_id,sent_on,sent_to,fault,under_warranty) values($1,$2,$3,$4,$5,$6) returning code,sent_on,sent_to,fault,under_warranty',
      [code, d.id, flags.date ? date(flags.date) : today(), flags.to || null, required(flags.fault, 'fault (--fault)'), flags.warranty ? true : (d.warranty_until && ymd(d.warranty_until) >= today())]);
  });
  if (cmd === 'repaired') return transaction(db, async () => {
    const r = await resolve(db, 'repairs', a[0]);
    if (r.returned_on) throw Error(`Repair ${r.code} came back on ${ymd(r.returned_on)}`);
    return db.query('update repairs set returned_on=$2,cost=coalesce($3,cost) where id=$1 returning code,sent_on,returned_on,cost',
      [r.id, flags.date ? date(flags.date) : today(), flags.cost !== undefined ? number(flags.cost, 'cost', { min: 0 }) : null]);
  });

  if (cmd === 'consent') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a.join(' ') || undefined);
    return db.query('update clients set consent_on=$2 where id=$1 returning code,name,consent_on', [c.id, flags.date ? date(flags.date) : today()]);
  });
  if (cmd === 'voucher') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a[0]);
    return db.query('insert into vouchers(code,client_id,issued_on,expires_on) values($1,$2,$3,$4) returning code,issued_on,expires_on',
      [required(a[1], 'voucher number'), c.id, date(flags.issued, 'issued date (--issued)'), date(flags.expires, 'expiry date (--expires)')]);
  });
  if (cmd === 'approval') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a[0]);
    return db.query('insert into approvals(code,client_id,funder,approved_on,amount) values($1,$2,$3,$4,$5) returning code,funder,approved_on,amount',
      [required(a[1], 'approval reference'), c.id, oneOf(flags.funder, ['acc', 'hafs', 'msd', 'hsp'], 'funder (--funder)'), flags.date ? date(flags.date) : today(), flags.amount ? number(flags.amount, 'amount', { min: 0 }) : null]);
  });

  if (cmd === 'claim') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a.join(' ') || undefined);
    const d = flags.device ? await resolve(db, 'devices', flags.device) : null;
    const code = await nextCode(db, 'claims', 'K', 9500);
    return db.query('insert into claims(code,client_id,device_id,funder,item,service_on,amount) values($1,$2,$3,$4,$5,$6,$7) returning code,funder,item,service_on,amount',
      [code, c.id, d?.id || null, oneOf(flags.funder, ['hsp', 'msd', 'acc', 'hafs'], 'funder (--funder)'), required(flags.item, 'item (--item)'), flags.date ? date(flags.date) : today(), number(flags.amount, 'amount (--amount)', { min: 0 })]);
  });
  if (cmd === 'lodge' || cmd === 'claim-paid') return transaction(db, async () => {
    const k = await resolve(db, 'claims', a[0]);
    const on = flags.date ? date(flags.date) : today();
    if (cmd === 'lodge') {
      if (k.lodged_on) throw Error(`Claim ${k.code} was lodged on ${ymd(k.lodged_on)}`);
      return db.query('update claims set lodged_on=$2,ref=coalesce($3,ref) where id=$1 returning code,lodged_on,ref', [k.id, on, flags.ref || null]);
    }
    if (!k.lodged_on) throw Error(`Claim ${k.code} has not been lodged`);
    if (k.paid_on) throw Error(`Claim ${k.code} was paid on ${ymd(k.paid_on)}`);
    return db.query('update claims set paid_on=$2 where id=$1 returning code,lodged_on,paid_on,amount', [k.id, on]);
  });

  if (cmd === 'invoice') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a[0]);
    const amount = number(a[1], 'amount', { min: 0 });
    const day = flags.date ? date(flags.date) : today();
    const code = await nextCode(db, 'invoices', 'INV-', 5000);
    return db.query('insert into invoices(code,client_id,issued_on,due_on,description,amount) values($1,$2,$3,$4,$5,$6) returning code,issued_on,due_on,description,amount',
      [code, c.id, day, addDays(day, flags['due-days'] ? number(flags['due-days'], 'due days', { min: 0 }) : 14), required(flags.description, 'description (--description)'), amount]);
  });
  if (cmd === 'pay') return transaction(db, async () => {
    const amount = number(a[1], 'amount', { positive: true });
    let inv = (await db.query('select * from invoices where lower(code)=lower($1)', [String(a[0] || '')]))[0];
    if (!inv) {
      const c = await resolve(db, 'clients', a[0]);
      inv = (await db.query('select i.* from invoices i where i.client_id=$1 and i.amount>(select coalesce(sum(p.amount),0) from payments p where p.invoice_id=i.id) order by i.due_on limit 1', [c.id]))[0];
      if (!inv) throw Error(`${c.code} has no unpaid invoice`);
    }
    await db.query('insert into payments(invoice_id,paid_on,amount,ref) values($1,$2,$3,$4)', [inv.id, flags.date ? date(flags.date) : today(), amount, required(flags.ref, 'reference (--ref)')]);
    return db.query('select b.client,b.name,b.charged,b.paid,b.owing from v_balances b where b.client_id=$1', [inv.client_id]);
  });

  if (cmd === 'status') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a[0]);
    const st = oneOf(a[1], ['active', 'archived', 'deceased'], 'status');
    return db.query('update clients set status=$2 where id=$1 returning code,name,status', [c.id, st]);
  });
  if (cmd === 'setting') return transaction(db, async () => {
    const key = required(a[0], 'setting key');
    const r = await db.query('update settings set value=$2 where key=$1 returning key,value,unit', [key, number(a[1], 'value')]);
    if (!r.length) throw Error(`No setting ${key}. Run settings to list them`);
    return r;
  });
  if (cmd === 'log') return transaction(db, async () => {
    const c = await resolve(db, 'clients', a[0]);
    return db.query('insert into notes(client_id,body) values($1,$2) returning created_at,body', [c.id, required(a.slice(1).join(' '), 'note')]);
  });

  if (cmd.startsWith('draft-')) return draft(db, cmd, a.join(' '));
  throw Error(`Unknown command: ${cmd}. Run help`);
}

async function add(db, a, flags) {
  const [what, code, ...rest] = a;
  const name = rest.join(' ');
  const optDate = (k) => (flags[k] ? date(flags[k], k) : null);
  if (what === 'clinic') {
    return db.query('insert into clinics(code,name,country,address) values($1,$2,$3,$4) returning code,name,country',
      [required(code, 'clinic code').toUpperCase(), required(name, 'name'), flags.country ? oneOf(flags.country, ['au', 'nz'], 'country').toUpperCase() : 'AU', flags.address || null]);
  }
  if (what === 'clinician') {
    return db.query('insert into clinicians(code,name,role,registration_no,registration_expiry,hsp_qualified) values($1,$2,$3,$4,$5,$6) returning code,name,role',
      [required(code, 'clinician code').toUpperCase(), required(name, 'name'), flags.role ? oneOf(flags.role, ['audiologist', 'audiometrist', 'assistant'], 'role') : 'audiologist', flags.registration || null, optDate('expires'), Boolean(flags.hsp)]);
  }
  if (what === 'client') {
    const full = required([code, ...rest].filter(Boolean).join(' '), 'name');
    const k = flags.clinic ? await resolve(db, 'clinics', flags.clinic) : null;
    const cl = flags.clinician ? await resolve(db, 'clinicians', flags.clinician) : null;
    const c = flags.code ? String(flags.code).toUpperCase() : await nextCode(db, 'clients', 'C', 2000);
    return db.query('insert into clients(code,name,dob,phone,email,clinic_id,clinician_id,funder,referral_source,gp_name) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning code,name,funder',
      [c, full, optDate('dob'), flags.phone || null, flags.email || null, k?.id || null, cl?.id || null, flags.funder ? oneOf(flags.funder, funders, 'funder') : 'private', flags.referral || null, flags.gp || null]);
  }
  if (what === 'product') {
    return db.query('insert into products(code,brand,model,kind,tier,price,warranty_months) values($1,$2,$3,$4,$5,$6,$7) returning code,brand,model,price',
      [required(code, 'product code').toUpperCase(), required(flags.brand, 'brand (--brand)'), required(flags.model, 'model (--model)'), flags.kind ? oneOf(flags.kind, ['aid', 'accessory', 'charger'], 'kind') : 'aid',
        flags.tier || null, flags.price ? number(flags.price, 'price', { min: 0 }) : 0, flags['warranty-months'] ? number(flags['warranty-months'], 'warranty months', { min: 0 }) : 36]);
  }
  throw Error('add clinic|clinician|client|product');
}

// Auditdata Manage exports: a client list, an appointment list and a sales (devices) list,
// each saved from its report as CSV. Audiograms stay in Noah; bring the latest by hand with `test`.
const importFiles = [
  { match: /^(clients?|customers?|patients?)/, entity: 'clients' },
  { match: /^(appointments?|bookings?|diary)/, entity: 'appointments' },
  { match: /^(sales?|devices?|hearing.?aids?|serials?)/, entity: 'devices' },
];

async function importAuditdata(db, a, flags) {
  if (a[0] !== 'auditdata') throw Error('Supported import: auditdata. See docs/replace-auditdata-manage.md');
  const dir = path.resolve(required(a[1], 'folder of Auditdata Manage CSV exports'));
  const mapping = flags.map ? JSON.parse(fs.readFileSync(flags.map, 'utf8')) : {};
  const files = fs.readdirSync(dir).filter((n) => /\.csv$/i.test(n));
  if (!files.length) throw Error(`No CSV files in ${dir}`);
  const rank = (f) => { const i = importFiles.findIndex((x) => x.match.test(f.toLowerCase())); return i < 0 ? 9 : i; };
  files.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  return transaction(db, async () => {
    const out = [];
    for (const file of files) {
      const spec = importFiles.find((x) => x.match.test(file.toLowerCase()));
      if (!spec) throw Error(`Unrecognised file ${file}: expected Clients, Appointments or Sales. See docs/replace-auditdata-manage.md`);
      const rows = parseCsv(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!rows.length) throw Error(`Empty file: ${file}`);
      let added = 0;
      for (const raw of rows) {
        const row = { ...raw };
        for (const [ours, theirs] of Object.entries(mapping[spec.entity] || {})) {
          if (!(theirs in raw)) throw Error(`${file}: mapped column "${theirs}" is not in the file`);
          row[ours] = raw[theirs];
        }
        if (spec.entity === 'clients') await importClient(db, file, row);
        else if (spec.entity === 'appointments') await importAppointment(db, file, row);
        else if (await importDevice(db, file, row) === false) continue;
        added++;
      }
      out.push({ file, entity: spec.entity, rows: added, dry_run: Boolean(flags['dry-run']) });
    }
    return out;
  }, Boolean(flags['dry-run']));
}

// Day-first dates (31/12/2025) as AU and NZ exports write them, or ISO.
function dayOf(v, what) {
  const s = String(v || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return date(iso[0], what);
  const dm = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dm) return date(`${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`, what);
  throw Error(`Invalid ${what}: ${s}. Use DD/MM/YYYY or YYYY-MM-DD`);
}
const funderOf = (v) => {
  const s = String(v || '').toLowerCase();
  if (/hsp|hearing services|voucher|ohs|dva/.test(s)) return 'hsp';
  if (/acc/.test(s)) return 'acc';
  if (/msd|subsidy|work and income|winz/.test(s)) return 'msd';
  if (/funding scheme|hafs|whaikaha|enable/.test(s)) return 'hafs';
  return 'private';
};
async function clientFor(db, file, row) {
  const id = pick(row, 'Client number', 'Client ID', 'Customer number', 'Patient ID', 'Client no');
  const name = pick(row, 'Client', 'Client name', 'Customer', 'Patient', 'Name');
  const r = await db.query('select * from clients where lower(code)=lower($1) or lower(name)=lower($2)', [id ? `AD-${id}` : '', name]);
  if (r.length !== 1) throw Error(`${file}: client "${id || name}" ${r.length ? 'matches more than one record' : 'is not in the database or the Clients file'}`);
  return r[0];
}

async function importClient(db, file, row) {
  const name = pick(row, 'Name', 'Full name', 'Client name') || [pick(row, 'First name', 'Firstname'), pick(row, 'Last name', 'Lastname', 'Surname')].filter(Boolean).join(' ');
  required(name, `${file}: Name`);
  const id = pick(row, 'Client number', 'Client ID', 'Customer number', 'Patient ID', 'Client no');
  const code = id ? `AD-${id}` : await nextCode(db, 'clients', 'C', 2000);
  const clinic = pick(row, 'Clinic', 'Location', 'Shop');
  const k = clinic ? (await db.query('select id from clinics where lower(code)=lower($1) or lower(name)=lower($1)', [clinic]))[0] : null;
  const clin = pick(row, 'Audiologist', 'Clinician', 'Responsible person', 'Practitioner');
  const cl = clin ? (await db.query('select id from clinicians where lower(code)=lower($1) or lower(name)=lower($1)', [clin]))[0] : null;
  const status = /inactive|deceased|archiv/i.test(pick(row, 'Status', 'Active')) ? (/deceased/i.test(pick(row, 'Status')) ? 'deceased' : 'archived') : 'active';
  await db.query(`insert into clients(code,name,dob,phone,email,address,clinic_id,clinician_id,funder,referral_source,gp_name,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    on conflict(code) do update set name=excluded.name,phone=coalesce(excluded.phone,clients.phone),email=coalesce(excluded.email,clients.email),status=excluded.status`,
    [code, name, dayOf(pick(row, 'Date of birth', 'DOB', 'Birthdate'), `${file} ${name}: date of birth`), pick(row, 'Mobile', 'Phone', 'Mobile phone') || null, pick(row, 'Email', 'E-mail') || null,
      [pick(row, 'Address', 'Street'), pick(row, 'City', 'Suburb'), pick(row, 'Postcode', 'Zip')].filter(Boolean).join(', ') || null,
      k?.id || null, cl?.id || null, funderOf(pick(row, 'Funding', 'Payer', 'Funder', 'Client type', 'Third party')), pick(row, 'Referral source', 'Lead source', 'Referred by', 'Source') || null,
      pick(row, 'GP', 'Doctor', 'Referring doctor') || null, status]);
}

const kindOf = (v) => {
  const s = String(v || '').toLowerCase();
  if (/fit/.test(s)) return 'fitting';
  if (/follow|aftercare|adjust/.test(s)) return 'follow-up';
  if (/review|annual|recall|retest/.test(s)) return 'review';
  if (/repair|service/.test(s)) return 'repair';
  if (/wax|clean/.test(s)) return 'clean';
  if (/assess|test|hearing check|audiogram|initial/.test(s)) return 'assessment';
  return 'consult';
};
async function importAppointment(db, file, row) {
  const c = await clientFor(db, file, row);
  const day = dayOf(required(pick(row, 'Date', 'Start date', 'Appointment date'), `${file}: Date`), `${file}: Date`);
  const start = (pick(row, 'Start time', 'Time', 'Start') || '09:00').slice(0, 5).padStart(5, '0');
  const st = pick(row, 'Status', 'Appointment status').toLowerCase();
  const status = /no.?show|dna|did not/.test(st) ? 'no-show' : /cancel/.test(st) ? 'cancelled' : day < today() ? 'attended' : 'booked';
  const clin = pick(row, 'Audiologist', 'Clinician', 'Resource', 'Practitioner');
  const cl = clin ? (await db.query('select id from clinicians where lower(code)=lower($1) or lower(name)=lower($1)', [clin]))[0] : null;
  const id = pick(row, 'Appointment ID', 'ID', 'Booking number');
  const kind = kindOf(pick(row, 'Type', 'Appointment type', 'Service'));
  const code = `AD-${id || `${c.code}-${day}-${start.replace(':', '')}`}`;
  const minutes = Number(pick(row, 'Duration', 'Minutes', 'Length')) || 60;
  await db.query('insert into appointments(code,client_id,clinician_id,clinic_id,on_date,starts,minutes,kind,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(code) do nothing',
    [code, c.id, cl?.id || c.clinician_id, c.clinic_id, day, time(start, `${file} ${code}: start time`), minutes, kind, status]);
}

// One sales line with a serial number or an ear is one device. Other lines (services, batteries) are skipped.
async function importDevice(db, file, row) {
  const model = pick(row, 'Product', 'Model', 'Item', 'Product name', 'Description');
  if (!model || (!pick(row, 'Serial number', 'Serial', 'S/N') && !pick(row, 'Side', 'Ear', 'L/R'))) return false;
  const c = await clientFor(db, file, row);
  const brand = pick(row, 'Manufacturer', 'Brand', 'Supplier') || model.split(/\s+/)[0];
  const day = dayOf(required(pick(row, 'Fitting date', 'Date', 'Sale date', 'Invoice date'), `${file}: Date`), `${file}: Date`);
  const price = Number(String(pick(row, 'Price', 'Amount', 'Line total', 'Total') || '0').replace(/[$,]/g, '')) || 0;
  const code = model.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 30);
  await db.query('insert into products(code,brand,model,price) values($1,$2,$3,$4) on conflict(code) do nothing', [code, brand, model, price]);
  const p = (await db.query('select * from products where code=$1', [code]))[0];
  const side = pick(row, 'Side', 'Ear', 'L/R').toUpperCase();
  const ear = /^L/.test(side) ? 'L' : /^R/.test(side) ? 'R' : '-';
  const st = pick(row, 'Status', 'Trial status').toLowerCase();
  const outcome = /return|credit|refund/.test(st) ? 'returned' : /trial/.test(st) ? 'trial' : /replace/.test(st) ? 'replaced' : 'kept';
  const serial = pick(row, 'Serial number', 'Serial', 'S/N') || null;
  const warranty = dayOf(pick(row, 'Warranty expiry', 'Warranty until', 'Warranty end'), `${file}: warranty`) || addDays(day, 30 * p.warranty_months + Math.floor(p.warranty_months / 2));
  const trial = outcome === 'trial' ? (dayOf(pick(row, 'Trial end', 'Trial end date'), `${file}: trial end`) || addDays(day, await setting(db, 'trial_days'))) : null;
  await db.query(`insert into devices(code,client_id,product_id,ear,serial,funder,clinician_id,fitted_on,trial_ends,outcome,decided_on,warranty_until,price)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(code) do nothing`,
    [`AD-${serial || `${c.code}-${day}-${ear}`}`, c.id, p.id, ear, serial, funderOf(pick(row, 'Funding', 'Payer', 'Funder')) === 'private' ? c.funder : funderOf(pick(row, 'Funding', 'Payer', 'Funder')),
      c.clinician_id, day, trial, outcome, outcome === 'trial' ? null : day, warranty, price]);
}

async function draft(db, cmd, ref) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const c = await resolve(db, 'clients', ref || undefined);
  const v = (await db.query('select * from v_clients where client_id=$1', [c.id]))[0];
  const brand = (() => { try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')).business_name; } catch { return 'the clinic'; } })();
  const first = c.name.split(' ')[0];
  const to = `To: ${c.email || (c.phone ? `${c.phone} (text)` : '(no email or mobile on file)')}`;
  const devices = await db.query("select model,ear,fitted_on,warranty_until,outcome,trial_ends from v_devices where client_id=$1 and outcome in ('trial','kept') order by fitted_on desc", [c.id]);
  let body;
  if (cmd === 'draft-recall') {
    body = `# DRAFT: hearing review reminder for ${c.name}\n\n${to}\n\nHi ${first},\n\nIt has been ${v.last_test ? `since ${ymd(v.last_test)}` : 'a while'} since your last hearing check with ${brand}. We recommend a check every ${await setting(db, 'recall_months')} months, so we can see whether anything has changed and keep your hearing aids set up for you.\n\n${devices.length ? `We will also give your ${devices.map((d) => d.model).filter((m, i, x) => x.indexOf(m) === i).join(' and ')} a clean and a check while you are in.\n\n` : ''}Reply with a day and time that suit, or call us, and we will book you in.\n\nFor review before sending. Nothing has been sent.\n`;
  } else if (cmd === 'draft-trial-check') {
    const trial = devices.filter((d) => d.outcome === 'trial');
    if (!trial.length) throw Error(`${c.code} has nothing on trial`);
    body = `# DRAFT: trial check-in for ${c.name}\n\n${to}\n\nHi ${first},\n\nYour trial of the ${trial[0].model} ${trial.length > 1 ? 'pair' : 'aid'} runs until ${ymd(trial[0].trial_ends)}. How are you finding them, at home, on the phone and somewhere noisy?\n\nMost people need a fine-tune or two in the first weeks. Let us book a short follow-up before the trial ends, so we can adjust anything that is not right and talk through whether you want to keep them.\n\nFor review before sending. Nothing has been sent.\n`;
  } else if (cmd === 'draft-gp-letter') {
    const t = (await db.query('select * from v_tests where client_id=$1 order by tested_on desc limit 1', [c.id]))[0];
    if (!t) throw Error(`${c.code} has no hearing test on file`);
    const raw = (await db.query('select * from tests where code=$1', [t.code]))[0];
    const cl = (await db.query('select name,role from clinicians where id=$1', [raw.clinician_id]))[0];
    body = `# DRAFT: hearing assessment report to GP for ${c.name}\n\nTo: ${c.gp_name || '(GP not recorded)'}\n\nRe: ${c.name}${c.dob ? `, born ${ymd(c.dob)}` : ''}\n\nThank you for referring ${first}. Their hearing was assessed at ${brand} on ${ymd(t.tested_on)}.\n\n| Ear | 500 Hz | 1 kHz | 2 kHz | 4 kHz | Average |\n|---|---|---|---|---|---|\n| Left | ${raw.l500 ?? '-'} | ${raw.l1000 ?? '-'} | ${raw.l2000 ?? '-'} | ${raw.l4000 ?? '-'} | ${t.left_4fa ?? '-'} dB HL |\n| Right | ${raw.r500 ?? '-'} | ${raw.r1000 ?? '-'} | ${raw.r2000 ?? '-'} | ${raw.r4000 ?? '-'} | ${t.right_4fa ?? '-'} dB HL |\n\n${t.worse_by >= 10 ? `The hearing has changed by up to ${t.worse_by} dB since the previous test on ${ymd(t.previous_on)}.\n\n` : ''}Plan: ${{ fit: 'hearing aids recommended; a trial has been offered', review: 'review in 12 months', refer: 'referral for ENT opinion recommended', none: 'no further action' }[t.recommendation]}.${t.note ? `\n\nNotes: ${t.note}` : ''}\n\n${cl?.name || '(clinician)'}, ${cl?.role || ''}\n\nThe clinician checks the findings and signs before this is sent. Nothing has been sent.\n`;
  } else if (cmd === 'draft-upgrade') {
    const u = (await db.query('select * from v_upgrades where code=$1', [c.code]))[0];
    if (!u) throw Error(`${c.code} is not yet due new hearing aids under their funder's rule`);
    body = `# DRAFT: new hearing aids for ${c.name}\n\n${to}\n\nHi ${first},\n\nYour ${u.models} were fitted on ${ymd(u.oldest_kept)}. ${c.funder === 'hsp' ? `From ${ymd(u.eligible_from)} you are able to have new devices through the Hearing Services Program.` : c.funder === 'msd' ? `From ${ymd(u.eligible_from)} you may be able to use the hearing aid subsidy again.` : 'Hearing aids have come a long way in that time, especially in noisy places and with phone streaming.'}\n\nWe would like to book a hearing check first, to see what has changed, and then let you try the newer aids before deciding anything.\n\nFor review before sending. Nothing has been sent. Check the funder rules for this client before sending.\n`;
  } else if (cmd === 'draft-statement') {
    const lines = await db.query("select issued_on on_date,description item,amount debit,null::numeric credit from invoices where client_id=$1 union all select p.paid_on,'Payment '||coalesce(p.ref,''),null,p.amount from payments p join invoices i on i.id=p.invoice_id where i.client_id=$1 order by 1,2", [c.id]);
    const b = (await db.query('select * from v_balances where client_id=$1', [c.id]))[0];
    if (!b) throw Error(`${c.code} has no invoices`);
    body = `# DRAFT: statement of account for ${c.name}\n\n${to}\n\n| Date | Item | Charged | Paid |\n|---|---|---|---|\n${lines.map((l) => `| ${ymd(l.on_date)} | ${l.item} | ${l.debit ?? ''} | ${l.credit ?? ''} |`).join('\n')}\n\n- Charged: ${b.charged}\n- Paid: ${b.paid}\n- Owing: ${b.owing}\n\nFor review before sending. Nothing has been sent.\n`;
  } else throw Error(`Unknown draft: ${cmd}`);
  const file = path.join(dir, `${cmd.replace('draft-', '')}-${c.code}-${Date.now()}.md`);
  fs.writeFileSync(file, body);
  return [{ file, client: c.code }];
}

function print(value) {
  if (Array.isArray(value)) { console.log(value.length ? table(value, Object.keys(value[0]).map((key) => ({ key, label: key, format: fmt }))) : '(none)'); return; }
  for (const [key, v] of Object.entries(value)) { console.log(`\n${key}`); print(Array.isArray(v) ? v : [v]); }
}
function fmt(v) {
  if (v instanceof Date) return v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10).replace('T', ' ');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (typeof v === 'string' && /^\d{2}:\d{2}:00$/.test(v)) return v.slice(0, 5);
  return v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const out = await run(db, process.argv.slice(2).filter((x) => x !== '--json'));
    if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2)); else print(out);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
