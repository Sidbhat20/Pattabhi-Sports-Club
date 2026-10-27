// Fills September 2026 with sample data on the real dashboard:
//   - 48 students paid by UPI, 7 paid cash, 5 yet to pay
//   - coach attendance for all 26 non-Sunday sessions
//   - September expenses: rent, utilities, water, equipment, and full coach pay
// Run with the server running:  PSC_USER=Sid PSC_PASS=... node scripts/sample-september.mjs
// Safe to re-run. Parts that already exist are skipped.
const base = process.env.PSC_URL || 'http://localhost:3000';
const auth = `Basic ${Buffer.from(`${process.env.PSC_USER}:${process.env.PSC_PASS}`).toString('base64')}`;
const MONTH = '2026-09';
const ABSENT = { Sangeetha: 5, Ranga: 9, 'Anand Rao (Caretaker)': 0, Mahesh: 7, Shridhar: 3 };

let seed = 909;
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
// Sample monthly pay for coaches who have none yet (not real figures).
const PAY = { Sangeetha: 8000, Shridhar: 8000, Mahesh: 7500, Ranga: 7000, 'Anand Rao (Caretaker)': 9000 };
for (const c of data.coaches) {
  if (!c.monthly_pay && PAY[c.name]) await call('PUT', `coaches/${c.id}`, { monthly_pay: PAY[c.name] });
}
const pad = (n) => String(n).padStart(2, '0');

// 1. Fees
if (data.payments.some((p) => p.for_month === MONTH)) {
  console.log('September payments already exist. Skipping fees.');
} else {
  const fee = new Map(data.batches.map((b) => [b.id, b.monthly_fee]));
  const students = shuffle(data.students.filter((s) => s.status === 'active'));
  for (let i = 0; i < 55; i++) {
    const s = students[i];
    const method = i < 48 ? 'UPI' : 'Cash';
    const amount = Math.max(0, (fee.get(s.batch_id) || 0) - (s.discount || 0));
    await call('POST', 'payments', { student_id: String(s.id), amount, for_month: MONTH, paid_on: `${MONTH}-${pad(2 + Math.floor(rnd() * 22))}`, method, note: '' });
  }
}

// 2. Coach attendance: every Mon–Sat in September (26 sessions)
const sessions = [];
for (let d = 1; d <= 30; d++) {
  if (new Date(2026, 8, d).getDay() !== 0) sessions.push(`${MONTH}-${pad(d)}`);
}
const existingCoach = (await call('GET', `attendance?month=${MONTH}`)).some((r) => r.person_type === 'coach');
if (existingCoach) {
  console.log('September coach attendance already exists. Skipping.');
} else {
  const perDay = new Map(sessions.map((d) => [d, []]));
  for (const c of data.coaches.filter((c) => c.status === 'active')) {
    const absentDays = new Set(shuffle(sessions).slice(0, ABSENT[c.name] ?? 0));
    for (const d of sessions) perDay.get(d).push({ person_type: 'coach', person_id: c.id, status: absentDays.has(d) ? 'absent' : 'present' });
  }
  for (const [day, records] of perDay) await call('PUT', 'attendance', { day, records });
}

// 3. Expenses
if (data.expenses.some((e) => e.day.startsWith(MONTH))) {
  console.log('September expenses already exist. Skipping.');
} else {
  const add = (day, category, amount, note = '', coach_id = '') => call('POST', 'expenses', { day, category, amount, note, coach_id: coach_id ? String(coach_id) : '' });
  await add(`${MONTH}-01`, 'Court rent', 6000, 'Indoor court, monthly');
  await add(`${MONTH}-10`, 'Utilities', 1800, 'Electricity');
  await add(`${MONTH}-15`, 'Water & snacks', 900);
  await add(`${MONTH}-18`, 'Equipment', 2400, 'Balls and cones');
  for (const c of data.coaches.filter((c) => c.status === 'active' && c.monthly_pay > 0)) {
    await add(`${MONTH}-03`, 'Coach pay', c.monthly_pay, `${c.name}, September`, c.id);
  }
}

console.log(`Done. September: fees, ${sessions.length} coach sessions and expenses are in place.`);
