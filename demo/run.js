// Client demo: a separate server with its own sample database. The real club database is never touched.
// Run with: npm run demo   (Ctrl+C stops it)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'demo', 'data');
const port = process.env.DEMO_PORT || '3100';
const base = `http://localhost:${port}`;
const auth = `Basic ${Buffer.from('demo:demo').toString('base64')}`;
const deviceKey = 'demo-device-key';
const now = new Date();
const today = now.toLocaleDateString('en-CA');
const thisMonth = today.slice(0, 7);

// Seeded random numbers, so every demo run shows the same figures.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pad = (n) => String(n).padStart(2, '0');
const monthsBack = (k) => {
  const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const call = async (method, p, body) => {
  const res = await fetch(`${base}/api/${p}`, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p}: ${json.error || res.status}`);
  return json;
};

const punch = (biometricId, at) =>
  fetch(`${base}/api/biometric/punch`, {
    method: 'POST',
    headers: { 'X-Device-Key': deviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'gate-1', biometric_id: String(biometricId), at: at.toISOString() }),
  });

const waitForServer = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      await call('GET', 'info');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error('The demo server did not start');
};

const COACHES = [
  ['Sangeetha', 8000],
  ['Shridhar', 8000],
  ['Mahesh', 7500],
  ['Ranga', 7000],
  ['Anand Rao (Caretaker)', 9000],
];
const BATCHES = [
  ['Juniors', 'Ranga', 900, 'Mon, Wed, Fri · 5:00–6:00 PM', [6, 9]],
  ['U13', 'Sangeetha', 1200, 'Mon, Wed, Fri · 6:00–7:30 PM', [10, 12]],
  ['U16', 'Shridhar', 1500, 'Tue, Thu, Sat · 6:00–7:30 PM', [13, 15]],
  ['U18', 'Mahesh', 1800, 'Tue, Thu, Sat · 7:30–9:00 PM', [16, 20]],
];
const FIRST = ['Aarav','Vihaan','Aditya','Arjun','Sai','Reyansh','Ishaan','Kabir','Rohan','Kiran','Ananya','Diya','Meera','Saanvi','Pooja','Priya','Aditi','Nisha','Harsha','Tanvi','Dhruv','Yash','Karthik','Manoj','Varun','Shreya','Lakshmi','Divya','Sneha','Rahul','Pranav','Nikhil','Akash','Gautam','Rishi','Anvi','Kavya','Riya','Sanjana','Mohit','Vikram','Tejas','Chirag','Hemanth','Sindhu','Bhavana','Keerthi','Ritika','Siddharth','Ayaan','Shravan','Pavan','Naveen','Ravi','Sowmya','Chaitra','Deepika','Madhu','Ramya','Yashwanth','Abhay','Suhas','Lavanya'];
const LAST = ['Sharma','Reddy','Rao','Nair','Iyer','Gowda','Patel','Kumar','Shetty','Hegde','Menon','Bhat','Kulkarni','Joshi','Naidu','Pillai','Singh','Verma','Murthy','Prasad','Pai','Desai','Kamath','Chandra','Mohan'];

async function seedAll() {
  const used = new Set();
  const name = () => {
    for (;;) {
      const n = `${pick(FIRST)} ${pick(LAST)}`;
      if (!used.has(n)) return used.add(n) && n;
    }
  };

  const coachIds = {};
  for (const [i, [n, pay]] of COACHES.entries()) {
    coachIds[n] = (await call('POST', 'coaches', { name: n, phone: '', monthly_pay: pay, status: 'active', biometric_id: `C${i + 1}` })).id;
  }
  const batches = [];
  for (const [label, coach, fee, schedule] of BATCHES) {
    const b = await call('POST', 'batches', { name: label, schedule, coach_id: String(coachIds[coach]), monthly_fee: fee, status: 'active' });
    batches.push({ ...b, fee });
  }

  // 60 students. Parent numbers are fake (99999…) so no real person is messaged.
  const students = [];
  let n = 0;
  for (const b of batches) {
    const [lo, hi] = BATCHES.find((x) => x[0] === b.name)[4];
    for (let i = 0; i < 15; i++) {
      n++;
      const age = between(lo, hi);
      const dob = new Date(now.getFullYear() - age, between(0, 11), between(1, 28)).toLocaleDateString('en-CA');
      const joined = n > 52 ? '2026-06-01' : '2026-01-05';
      const discount = n % 13 === 0 ? 200 : 0;
      const student = await call('POST', 'students', {
        name: name(),
        batch_id: String(b.id),
        dob,
        guardian_name: name(),
        guardian_phone: `99999${String(n).padStart(5, '0')}`,
        discount,
        joined_on: joined,
        biometric_id: String(1000 + n),
        status: 'active',
      });
      students.push({ ...student, batch: b, joined, discount, bio: 1000 + n });
    }
  }

  // Six months of fees. Past months are mostly paid, the current month is partly paid.
  for (let k = 5; k >= 0; k--) {
    const month = monthsBack(k);
    for (const s of students) {
      if (s.joined > `${month}-31`) continue;
      const fee = Math.max(0, s.batch.fee - s.discount);
      const r = rnd();
      let amount = 0;
      if (k > 0) amount = r < 0.82 ? fee : r < 0.92 ? Math.round(fee / 2) : 0;
      else amount = r < 0.55 ? fee : r < 0.65 ? Math.round(fee / 2) : 0;
      if (!amount) continue;
      const day = k > 0 ? between(2, 14) : between(1, 24);
      await call('POST', 'payments', {
        student_id: String(s.id),
        amount,
        for_month: month,
        paid_on: `${month}-${pad(day)}`,
        method: pick(['UPI', 'UPI', 'Cash', 'Bank transfer']),
        note: '',
      });
    }
  }

  // Expenses: rent, utilities, equipment, and monthly coach pay (one coach behind this month).
  for (let k = 5; k >= 0; k--) {
    const month = monthsBack(k);
    const lim = (d) => (k === 0 && d > now.getDate() ? null : `${month}-${pad(d)}`);
    const add = async (day, category, amount, extra = {}) => {
      if (!day) return;
      await call('POST', 'expenses', { day, category, amount, note: extra.note || '', coach_id: extra.coach_id ? String(extra.coach_id) : '' });
    };
    await add(lim(1), 'Court rent', 6000, { note: 'Indoor court, monthly' });
    await add(lim(10), 'Utilities', 1800, { note: 'Electricity' });
    await add(lim(15), 'Water & snacks', 900);
    if (k % 2 === 0) await add(lim(18), 'Equipment', 2400, { note: 'Balls and cones' });
    for (const [cname, pay] of COACHES) {
      if (k === 0 && (cname === 'Mahesh')) continue; // not paid yet this month
      const partial = k === 0 && cname === 'Ranga';
      await add(lim(3), 'Coach pay', partial ? Math.round(pay / 2) : pay, { coach_id: coachIds[cname], note: partial ? 'Part payment' : `${cname}, ${month}` });
    }
    if (k === 3) await add(lim(20), 'Travel', 3500, { note: 'District tournament' });
  }

  // Attendance for the last 30 weekdays, students and coaches.
  for (let back = 30; back >= 1; back--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const day = d.toLocaleDateString('en-CA');
    const records = students.map((s) => {
      const r = rnd();
      return { person_type: 'student', person_id: s.id, status: r < 0.82 ? 'present' : r < 0.9 ? 'late' : 'absent' };
    });
    for (const c of Object.values(coachIds).filter((x) => typeof x === 'number')) {
      records.push({ person_type: 'coach', person_id: c, status: 'present' });
    }
    await call('PUT', 'attendance', { day, records: records.slice(0, 1000) });
  }

  // Today: a few students marked absent by hand; everyone else arrives through the biometric device.
  await call('PUT', 'attendance', {
    day: today,
    records: students.slice(0, 3).map((s) => ({ person_type: 'student', person_id: s.id, status: 'absent' })),
  });
  for (const s of students.slice(3, 40)) {
    await punch(s.bio, new Date(now.getTime() - between(5, 150) * 60000));
  }

  // Sample messages: parents asking questions, and replies from the club.
  const db = new DatabaseSync(path.join(dataDir, 'psc.db'));
  const at = (mins) => new Date(now.getTime() - mins * 60000).toISOString();
  const insert = db.prepare('INSERT INTO messages (direction, phone, body, at, status) VALUES (?, ?, ?, ?, ?)');
  const p = (i) => `99999${String(i).padStart(5, '0')}`;
  insert.run('in', p(4), 'Hi, will Arjun be able to attend tomorrow? He has a school exam in the morning.', at(190), 'received');
  insert.run('out', p(4), 'Hello, yes. Training is in the evening, so it is fine. Please let us know if it changes.', at(180), 'demo');
  insert.run('in', p(9), 'What is the fee for the U16 batch from next month?', at(65), 'received');
  insert.run('in', p(9), 'Also, do we get a receipt for UPI payments?', at(63), 'received');
  insert.run('in', p(21), 'Our son has a cold. Will he be marked absent or can we just skip?', at(25), 'received');
  insert.run('out', p(9), 'Hello. U16 is ₹1,500 a month. Yes, every UPI payment gets a receipt from the office.', at(40), 'demo');
  db.close();
}

function startSimulator(students) {
  setInterval(() => {
    if (Math.random() < 0.3) {
      const s = students[Math.floor(Math.random() * students.length)];
      punch(s.bio, new Date());
    }
  }, 20000);
}

if (!existsSync(path.join(root, 'client', 'dist', 'index.html'))) {
  console.error('Build the app first: npm run build');
  process.exit(1);
}
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

const server = spawn(process.execPath, [path.join(root, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PSC_DEMO: '1', PSC_USER: 'demo', PSC_PASS: 'demo', PSC_DATA: dataDir, DEVICE_KEY: deviceKey, PORT: port, WA_TOKEN: '', WA_PHONE_ID: '', WA_APP_SECRET: '', WA_VERIFY_TOKEN: '' },
});
const stop = () => {
  server.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));

await waitForServer();
await seedAll();
const students = await call('GET', 'data').then((d) => d.students.map((s) => ({ id: s.id, bio: Number(s.biometric_id) })));
startSimulator(students);
console.log(`\nDemo ready: ${base}\nLogin: demo / demo\nSample data only. The real club database is not touched.\nA simulated biometric punch arrives every ~20 seconds. Press Ctrl+C to stop.\n`);
