// npm test: a temp database, migrate, seed twice, then every command and every rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, reads, help } from './clinic.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hearing-clinic-test-'));
// A blank URL keeps tests off any real database named in .env.
process.env.DATABASE_URL = ''; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
let db; let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const rejects = async (args, re) => { await assert.rejects(() => run(db, args), re); checks++; };
const child = (script, args = []) => {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env: process.env, encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(p.status, 0, p.stderr || p.stdout); checks++; return p.stdout;
};
const daysFrom = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rules = async () => (await run(db, ['compliance'])).map((r) => `${r.rule} ${r.record}`);

try {
  db = await getDb();
  eq((await migrate(db)).ran.length, 1); eq((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  eq((await run(db, ['clients'])).length, 16); eq((await run(db, ['tests'])).length, 22);
  eq((await db.query('select count(*)::int n from devices'))[0].n, 26);
  eq((await db.query('select count(*)::int n from appointments'))[0].n, 39);

  for (const name of Object.keys(reads)) ok(Array.isArray(await run(db, [name])), name);
  ok(help.length > 50, 'help lists every command');

  // The demo has something to say on every rule.
  const found = new Set((await run(db, ['compliance'])).map((r) => r.rule));
  for (const r of ['CONSENT-BEFORE-FIT', 'TEST-BEFORE-FIT', 'HSP-VOUCHER', 'HSP-REPLACEMENT', 'HSP-CLAIM-6-MONTHS', 'NZ-FUNDING-INTERVAL', 'FUNDER-APPROVAL', 'FOLLOW-UP-AFTER-FIT', 'TRIAL-UNDECIDED', 'CLAIM-NOT-LODGED', 'REGISTRATION']) ok(found.has(r), r);
  eq((await run(db, ['compliance'])).length, 21);
  ok(!(await rules()).some((r) => r.startsWith('TEST-BEFORE-FIT D300') && r !== 'TEST-BEFORE-FIT D3014'), 'only C1009 fitted without a test');

  // Tomorrow: every reason an appointment should not go ahead as booked.
  const t = Object.fromEntries((await run(db, ['tomorrow'])).map((r) => [r.code, r.problems]));
  eq(Object.keys(t), ['A2001', 'A2002', 'A2003', 'A2004', 'A2005', 'A2006']);
  eq(t.A2001, 'no signed consent on file');
  eq(t.A2002, 'clinician double booked'); eq(t.A2003, 'clinician double booked');
  eq(t.A2004, 'clinician registration expired');
  eq(t.A2005, ''); eq(t.A2006, 'account overdue');

  // The weekly rituals.
  const trials = await run(db, ['trials']);
  eq(trials.filter((r) => r.trial_days_left < 0).map((r) => r.code), ['D3003', 'D3004']);
  eq(trials.find((r) => r.code === 'D3001').follow_up, null);
  eq((await run(db, ['unfitted'])).map((r) => r.client), ['C1003', 'C1013', 'C1010', 'C1016']);
  eq((await run(db, ['recalls'])).map((r) => r.code), ['C1009', 'C1014', 'C1004']);
  eq((await run(db, ['upgrades'])).map((r) => r.code), ['C1005']);
  eq((await run(db, ['changed'])).map((r) => r.client), ['C1013']);
  eq((await run(db, ['debtors'])).map((r) => r.client), ['C1007', 'C1002', 'C1012']);
  eq(Number((await run(db, ['debtors'])).find((r) => r.client === 'C1002').owing), 5900);
  eq((await run(db, ['repairs']))[0].code, 'R7001');
  eq((await run(db, ['results'])).find((r) => r.code === 'JT').returned, 2);
  eq((await run(db, ['referrals'])).find((r) => r.source === 'GP').clients, 5);
  ok((await run(db, ['retention'])).every((r) => r.keep_until), 'retention dates');
  const attention = await run(db, ['attention']);
  for (const k of ['appointment with a problem', 'trial ending, no follow-up', 'trial overdue', 'tested, not fitted', 'review due', 'repair away too long', 'claim not lodged', 'claim unpaid', 'account overdue', 'eligible for new aids', 'warranty ending', 'voucher expiring', 'no-show not rebooked', 'registration due']) ok(attention.some((r) => r.kind === k), k);
  const c = await run(db, ['client', 'graham']);
  eq(c.client[0].code, 'C1002'); eq(c.devices.length, 2); eq(c.notes.length, 1);
  eq((await run(db, ['clinician', 'mia'])).clinician[0].code, 'MR');

  // Matching: partial codes and names, ambiguity lists candidates.
  await rejects(['client', 'C10'], /Ambiguous client.*C1001.*C1016/);
  await rejects(['client', 'Nobody'], /No matching client/);
  eq((await run(db, ['client', 'hemi'])).client[0].code, 'C1009');

  // Booking refuses an appointment with problems unless the clinic manager says yes.
  await rejects(['book', 'Fiona', `--date=${daysFrom(5)}`, '--start=09:00', '--kind=fitting'], /Not booked: no signed consent on file/);
  await rejects(['book', 'Dorothy', `--date=${daysFrom(5)}`, '--start=09:00', '--kind=fitting'], /clinician registration expired/);
  await rejects(['book', 'Hemi', '--date=2020-01-01', '--start=09:00', '--kind=review'], /in the past/);
  await rejects(['book', 'Hemi', `--date=${daysFrom(5)}`, '--start=9am', '--kind=review'], /Invalid start/);
  const b = await run(db, ['book', 'Hemi', `--date=${daysFrom(5)}`, '--start=09:00', '--kind=review']);
  eq(b[0].problems, '');
  ok(!(await run(db, ['recalls'])).some((r) => r.code === 'C1009'), 'booking clears the recall');
  eq((await run(db, ['book', 'Dorothy', `--date=${daysFrom(6)}`, '--start=09:00', '--kind=fitting', '--force']))[0].problems, 'clinician registration expired');
  await rejects(['attend', b[0].code], /has not happened yet/);
  await run(db, ['cancel', b[0].code, '--note=Rang to move it']);
  await rejects(['cancel', b[0].code], /is cancelled/);

  // Consent and a test, then the fitting goes through.
  await run(db, ['consent', 'Fiona']);
  eq((await run(db, ['tomorrow'])).find((r) => r.code === 'A2001').problems, '');
  const tt = await run(db, ['test', 'Fiona', '--left=30,35,45,55', '--right=25,35,45,50', '--recommend=fit']);
  eq(Number(tt[0].left_4fa), 41.3);
  await rejects(['test', 'Fiona', '--left=30,35,45', '--right=25,35,45,50'], /four thresholds/);
  await rejects(['test', 'Fiona', '--left=30,35,45,200', '--right=25,35,45,50'], /Invalid --left threshold/);
  await rejects(['fit', 'Fiona', '--product=SV5', '--ears=L,R', '--serials=A1'], /one serial per ear/);
  const fit = await run(db, ['fit', 'Fiona', '--product=SV5', '--ears=L,R', '--serials=SV5-99001,SV5-99002']);
  eq(fit.map((r) => r.outcome), ['trial', 'trial']);
  eq(fit[0].trial_ends, daysFrom(30));
  ok(!(await run(db, ['unfitted'])).some((r) => r.client === 'C1010'), 'fitting clears tested-not-fitted');
  // A fitting that breaks a rule is refused unless forced.
  await rejects(['fit', 'Hemi', '--product=KF7', '--ears=R'], /Not fitted: .*TEST-BEFORE-FIT/);
  await run(db, ['add', 'client', 'Ruth', 'Ngata', '--funder=acc', '--clinic=AKL', '--clinician=PS', '--code=C1100']);
  await run(db, ['consent', 'C1100']);
  await run(db, ['test', 'C1100', '--left=40,45,55,65', '--right=40,45,55,65', '--recommend=fit']);
  await rejects(['fit', 'C1100', '--product=SV5', '--ears=L'], /FUNDER-APPROVAL/);
  await run(db, ['approval', 'C1100', 'ACC-77812', '--funder=acc']);
  eq((await run(db, ['fit', 'C1100', '--product=SV5', '--ears=L', '--trial-days=14'])).length, 1);

  // Trials decided.
  await rejects(['keep', 'Nobody'], /No matching client/);
  eq((await run(db, ['keep', 'Graham'])).map((r) => r.outcome), ['kept', 'kept']);
  ok(!(await rules()).includes('TRIAL-UNDECIDED D3003'), 'kept clears the trial rule');
  await rejects(['keep', 'D3003'], /D3003 is kept/);
  await rejects(['return', 'SV5-99001'], /Required: reason/);
  eq((await run(db, ['return', 'SV5-99001', '--reason=Too loud in the classroom']))[0].outcome, 'returned');

  // Repairs, claims, money.
  const r = await run(db, ['repair', 'KF7-41871', '--fault=No sound', '--to=Kiri service centre']);
  eq(r[0].under_warranty, true);
  eq((await run(db, ['repaired', r[0].code, '--cost=0']))[0].cost !== undefined, true);
  await rejects(['repaired', r[0].code], /came back/);
  const k = await run(db, ['claim', 'Margaret', '--funder=hsp', '--item=Client review', '--amount=120']);
  await rejects(['claim-paid', k[0].code], /has not been lodged/);
  await run(db, ['lodge', 'K9003', '--ref=HSP-310001']);
  ok(!(await rules()).includes('CLAIM-NOT-LODGED K9003'), 'lodging clears the rule');
  await run(db, ['claim-paid', 'K9003']);
  eq((await run(db, ['claims'])).find((x) => x.code === 'K9003').state, 'paid');
  await rejects(['claim', 'Margaret', '--funder=nhs', '--item=x', '--amount=1'], /Invalid funder/);
  const inv = await run(db, ['invoice', 'Hemi', '450', '--description=Charging case and service']);
  eq(inv[0].due_on, daysFrom(14));
  eq(Number((await run(db, ['pay', 'Graham', '5900', '--ref=Card']))[0].owing), 0);
  await rejects(['pay', 'Graham', '10', '--ref=x'], /no unpaid invoice/);
  eq((await run(db, ['tomorrow'])).find((x) => x.code === 'A2006').problems, '');

  // Registration renewed clears the problem; settings change the rules.
  await db.query("update clinicians set registration_expiry=current_date+365 where code='JT'");
  eq((await run(db, ['tomorrow'])).find((x) => x.code === 'A2004').problems, '');
  await run(db, ['setting', 'follow_up_days', '60']);
  ok(!(await rules()).some((x) => x.startsWith('FOLLOW-UP-AFTER-FIT D3012')), 'setting changes the rule');
  await rejects(['setting', 'nope', '1'], /No setting nope/);
  await run(db, ['log', 'Susan', 'Booked a consult for next month.']);
  eq((await run(db, ['client', 'Susan'])).notes.length, 2);
  eq((await run(db, ['status', 'C1015', 'archived']))[0].status, 'archived');

  // Drafts land in drafts/ and never send.
  for (const [cmd, who, has] of [['draft-recall', 'Ken', 'hearing check'], ['draft-trial-check', 'Margaret', 'Kiri Basic 2'], ['draft-gp-letter', 'Robert', 'changed by up to'], ['draft-upgrade', 'Beryl', 'Hearing Services Program'], ['draft-statement', 'Lorraine', 'Owing: 380']]) {
    const d = await run(db, [cmd, who]);
    const text = fs.readFileSync(d[0].file, 'utf8');
    ok(text.includes('Nothing has been sent') && text.includes(has), `${cmd} ${who}`);
  }
  await rejects(['draft-upgrade', 'Hemi'], /not yet due new hearing aids/);
  await rejects(['draft-trial-check', 'Ken'], /nothing on trial/);

  // Export, then import Auditdata Manage exports with a dry run first.
  const counts = await run(db, ['export', path.join(temp, 'export')]);
  ok(counts.find((x) => x.entity === 'devices').rows === 29, 'export devices');
  ok(fs.existsSync(path.join(temp, 'export', 'manifest.json')), 'manifest');
  const fx = path.join(REPO_ROOT, 'tests', 'fixtures', 'auditdata');
  const before = (await db.query('select count(*)::int n from clients'))[0].n;
  const dry = await run(db, ['import', 'auditdata', fx, '--dry-run']);
  eq(dry.map((x) => `${x.entity}:${x.rows}`), ['clients:4', 'appointments:5', 'devices:3']);
  eq((await db.query('select count(*)::int n from clients'))[0].n, before);
  await run(db, ['import', 'auditdata', fx]);
  await run(db, ['import', 'auditdata', fx]);
  eq((await db.query('select count(*)::int n from clients'))[0].n, before + 4);
  const noel = await run(db, ['client', 'Noel Barker']);
  eq(noel.client[0].code, 'AD-50001'); eq(noel.client[0].funder, 'hsp'); eq(noel.client[0].clinician, 'MR');
  eq(noel.devices.map((x) => x.serial).sort(), ['KB2-90001', 'KB2-90002']);
  eq(noel.appointments.map((x) => x.kind).sort(), ['assessment', 'fitting']);
  eq((await run(db, ['client', 'Wendy'])).appointments[0].status, 'no-show');
  eq((await run(db, ['client', 'Tama'])).devices.length, 1);
  eq((await db.query("select status from clients where code='AD-50004'"))[0].status, 'deceased');
  const bad = path.join(temp, 'bad'); fs.mkdirSync(bad);
  fs.writeFileSync(path.join(bad, 'Sales.csv'), 'Client number,Client,Sale date,Product,Side,Serial number\n99999,Nobody Here,01/09/2026,Kiri Fit 7,Left,X1\n');
  await rejects(['import', 'auditdata', bad], /is not in the database or the Clients file/);
  fs.writeFileSync(path.join(bad, 'Sales.csv'), 'Cust,Day,Item,Ear,SN\n50002,01/09/2026,Kiri Fit 7,Right,KF7-90009\n');
  fs.writeFileSync(path.join(temp, 'map.json'), JSON.stringify({ devices: { 'Client number': 'Cust', 'Sale date': 'Day', Product: 'Item', Side: 'Ear', 'Serial number': 'SN' } }));
  eq((await run(db, ['import', 'auditdata', bad, `--map=${path.join(temp, 'map.json')}`]))[0].rows, 1);
  await rejects(['import', 'csv', bad], /Supported import: auditdata/);

  await db.close(); db = null;

  // The CLI, views and documents from the command line, like an operator would.
  ok(child('clinic.mjs', ['tomorrow']).includes('code'), 'cli tomorrow');
  ok(JSON.parse(child('clinic.mjs', ['attention', '--json'])).length > 0, 'cli json');
  const failed = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'clinic.mjs'), 'client', 'C10'], { env: process.env, encoding: 'utf8' });
  eq(failed.status, 1); ok(/Ambiguous client/.test(failed.stderr), 'ambiguous exits 1');
  ok(child('view.mjs').includes('view:'), 'views');
  ok(/document\(s\) rendered/.test(child('docs.mjs')), 'documents');
  for (const v of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'views.json'), 'utf8'))) ok(fs.existsSync(path.join(temp, 'views', `${v.name}.html`)), `view ${v.name}`);
  for (const d of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'documents.json'), 'utf8'))) ok(fs.readdirSync(path.join(temp, 'docs-out', d.name)).length > 0, `document ${d.name}`);

  // Every slash command names a real CLI command.
  const cmds = fs.readdirSync(path.join(REPO_ROOT, '.claude', 'commands')).filter((x) => x.endsWith('.md') && x !== 'README.md');
  const verbs = new Set([...help.map((h) => h.split(' ')[0]), 'help']);
  for (const f of cmds) {
    const body = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'commands', f), 'utf8');
    ok(/^---\ndescription: /.test(body), `${f} has a description`);
    for (const m of body.matchAll(/npm run clinic -- ([a-z0-9-]+)/g)) ok(verbs.has(m[1]), `${f} runs ${m[1]}`);
  }
  console.log(`PASS: ${checks} checks, ${cmds.length} slash commands, ${Object.keys(reads).length} reads`);
} finally {
  if (db) await db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
