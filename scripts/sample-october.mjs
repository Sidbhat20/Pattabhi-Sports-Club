// Fills the real dashboard with October 2026 sample data:
//   - batch fees, 45 students paid by UPI, 10 paid cash, 5 yet to pay
//   - coach attendance for 26 sessions (Mon–Sat, 1–30 Oct)
//   - a few random WhatsApp chats
// Run with the server running:  PSC_USER=Sid PSC_PASS=... node scripts/sample-october.mjs
// Safe to re-run. Parts that are already filled in are skipped.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.PSC_URL || 'http://localhost:3000';
const auth = `Basic ${Buffer.from(`${process.env.PSC_USER}:${process.env.PSC_PASS}`).toString('base64')}`;
const MONTH = '2026-10';
const FEES = { Juniors: 900, U13: 1200, U16: 1500, U18: 1800 };
const COACH_ABSENT = { Sangeetha: 4, Ranga: 8, 'Anand Rao (Caretaker)': 0, Mahesh: 10, Shridhar: 2 }; // present = 26 - absent

let seed = 2026;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

async function call(method, p, body) {
  const res = await fetch(`${base}/api/${p}`, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p}: ${json.error || res.status}`);
  return json;
}

const data = await call('GET', 'data');
const existingPayments = data.payments.filter((p) => p.for_month === MONTH).length;
const coachRowsOct = (await call('GET', `attendance?month=${MONTH}`)).filter((r) => r.person_type === 'coach').length;
const today = new Date().toLocaleDateString('en-CA');

// 1. Batch fees
for (const b of data.batches) {
  if (FEES[b.name] != null) await call('PUT', `batches/${b.id}`, { monthly_fee: FEES[b.name] });
}
// Parent numbers for the chats. Sample numbers only (99999…).
const chatStudents = [...data.students].sort((a, b) => a.id - b.id).slice(0, 5);
for (const s of chatStudents) {
  if (!s.guardian_phone) await call('PUT', `students/${s.id}`, { guardian_phone: `99999${String(s.id).padStart(5, '0')}` });
}
const batchFee = new Map(data.batches.map((b) => [b.id, FEES[b.name] ?? b.monthly_fee]));

// 2. Payments: 45 UPI, 10 cash, 5 yet to pay
const students = shuffle(data.students.filter((s) => s.status === 'active'));
const plan = students.map((s, i) => ({ s, method: i < 45 ? 'UPI' : i < 55 ? 'Cash' : null }));
let paidCount = 0;
if (existingPayments) console.log(`October payments already exist (${existingPayments}). Skipping payments.`);
for (const { s, method } of existingPayments ? [] : plan) {
  if (!method) continue;
  const amount = Math.max(0, (batchFee.get(s.batch_id) || 0) - (s.discount || 0));
  const day = String(1 + Math.floor(rnd() * 24)).padStart(2, '0');
  await call('POST', 'payments', { student_id: String(s.id), amount, for_month: MONTH, paid_on: `${MONTH}-${day}`, method, note: '' });
  paidCount++;
}

// 3. Coach attendance: 26 sessions, Mon–Sat, 1–30 October
const sessions = [];
for (let d = 1; d <= 31; d++) {
  const date = new Date(2026, 9, d);
  if (date.getDay() !== 0) sessions.push(`${MONTH}-${String(d).padStart(2, '0')}`);
}
const sessionDays = sessions.slice(0, 26);
const records = new Map(sessionDays.map((d) => [d, []]));
if (coachRowsOct) console.log('October coach attendance already exists. Skipping.');
for (const c of data.coaches.filter((c) => c.status === 'active')) {
  const absentDays = new Set(shuffle(sessionDays).slice(0, COACH_ABSENT[c.name] ?? 0));
  for (const d of sessionDays) records.get(d).push({ person_type: 'coach', person_id: c.id, status: absentDays.has(d) ? 'absent' : 'present' });
}
for (const [day, recs] of coachRowsOct ? [] : records) {
  if (recs.length) await call('PUT', 'attendance', { day, records: recs });
}

// 3b. Today: which coaches are on court, and what they are taking
const coachByName = new Map(data.coaches.map((c) => [c.name, c]));
const batchByName = new Map(data.batches.map((b) => [b.name, b]));
const todaysPlan = [
  ['Sangeetha', 'U16', 'Shooting'],
  ['Mahesh', 'U13', 'Dribbling'],
  ['Shridhar', 'U18', 'Pick and roll'],
  ['Ranga', 'Juniors', 'Footwork'],
];
if (!data.sessions.some((x) => x.day === today)) {
  await call('PUT', 'attendance', {
    day: today,
    records: [...coachByName.values()].map((c) => ({ person_type: 'coach', person_id: c.id, status: 'present' })),
  });
  for (const [name, batch, focus] of todaysPlan) {
    await call('POST', 'sessions', { day: today, coach_id: String(coachByName.get(name).id), batch_id: String(batchByName.get(batch).id), focus });
  }
} else {
  console.log('Today already has sessions. Skipping.');
}

// 4. WhatsApp: random chats with parents, written straight to the database
const db = new DatabaseSync(path.join(root, 'data', 'psc.db'));
const hasMessages = db.prepare('SELECT COUNT(*) AS n FROM messages').get().n;
let chats = 0;
if (!hasMessages) {
  const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
  const insert = db.prepare('INSERT INTO messages (direction, phone, body, at, status) VALUES (?, ?, ?, ?, ?)');
  const scripts = [
    [
      ['in', 'Hi, will he be able to attend tomorrow? He has a school exam in the morning.', 30],
      ['out', 'Hello, yes. Training is in the evening, so it is fine.', 28],
      ['in', 'Thank you. When is the next fee due?', 6],
    ],
    [
      ['in', 'What is the fee for the U16 batch from next month?', 52],
      ['in', 'Do we get a receipt for UPI payments?', 50],
      ['out', 'Yes. U16 is ₹1,500 a month, and every UPI payment gets a receipt.', 41],
    ],
    [['in', 'He has a cold. Can we skip this week?', 9]],
    [
      ['in', 'Is there a receipt for cash payments too?', 80],
      ['out', 'Yes. Ask at the front desk and we will write one.', 76],
    ],
    [
      ['in', 'Can she change to the 5 PM batch?', 20],
      ['out', 'We will check with the coach and let you know by tomorrow.', 18],
      ['in', 'Thanks, appreciate it.', 17],
    ],
  ];
  const fresh = await call('GET', 'data');
  const parents = chatStudents.map((s) => fresh.students.find((x) => x.id === s.id));
  scripts.forEach((script, i) => {
    chats++;
    const phone = parents[i].guardian_phone;
    for (const [dir, body, h] of script) {
      insert.run(dir, phone, body, hoursAgo(h), dir === 'in' ? 'received' : 'sent');
    }
  });
}
db.close();

console.log(`Done. ${paidCount} new payments. Coach attendance for ${sessionDays.length} sessions. Today's sessions logged. ${chats} WhatsApp chats${hasMessages ? ' (skipped: messages already exist)' : ''}.`);
