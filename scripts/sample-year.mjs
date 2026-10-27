// Fills January to August 2026 on the real dashboard with sample data, one month at a time:
//   - fees: about 48 UPI, 7 cash, 5 yet to pay each month
//   - coach attendance for every non-Sunday session
//   - expenses: rent, utilities, water, equipment, and coach pay
// Months that already have data are skipped, so September and October are untouched.
// Run with the server running:  PSC_USER=Sid PSC_PASS=... node scripts/sample-year.mjs
const base = process.env.PSC_URL || 'http://localhost:3000';
const auth = `Basic ${Buffer.from(`${process.env.PSC_USER}:${process.env.PSC_PASS}`).toString('base64')}`;
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const pad = (n) => String(n).padStart(2, '0');

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
const activeStudents = data.students.filter((s) => s.status === 'active');
const coaches = data.coaches.filter((c) => c.status === 'active');
const feeOf = new Map(data.batches.map((b) => [b.id, b.monthly_fee]));

for (const [mi, month] of MONTHS.entries()) {
  let seed = 100 + mi * 17;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const shuffle = (a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const [y, m] = month.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  console.log(`--- ${month}`);

  // Fees
  if (data.payments.some((p) => p.for_month === month)) {
    console.log('  fees already there, skipping');
  } else {
    const order = shuffle(activeStudents);
    const payers = Math.round(order.length * 0.8);
    for (let i = 0; i < payers; i++) {
      const s = order[i];
      const amount = Math.max(0, (feeOf.get(s.batch_id) || 0) - (s.discount || 0));
      const method = i < Math.round(payers * 0.87) ? 'UPI' : 'Cash';
      await call('POST', 'payments', { student_id: String(s.id), amount, for_month: month, paid_on: `${month}-${pad(2 + Math.floor(rnd() * 22))}`, method, note: '' });
    }
    console.log(`  fees: ${payers} paid, ${order.length - payers} yet to pay`);
  }

  // Coach attendance: every non-Sunday
  const sessions = [];
  for (let d = 1; d <= daysIn; d++) if (new Date(y, m - 1, d).getDay() !== 0) sessions.push(`${month}-${pad(d)}`);
  const existing = (await call('GET', `attendance?month=${month}`)).some((r) => r.person_type === 'coach');
  if (existing) {
    console.log('  coach attendance already there, skipping');
  } else {
    const perDay = new Map(sessions.map((d) => [d, []]));
    for (const c of coaches) {
      const maxAbsent = c.name.startsWith('Anand') ? 0 : 10;
      const absentCount = Math.floor(rnd() * (maxAbsent + 1));
      const absentDays = new Set(shuffle(sessions).slice(0, absentCount));
      for (const d of sessions) perDay.get(d).push({ person_type: 'coach', person_id: c.id, status: absentDays.has(d) ? 'absent' : 'present' });
    }
    for (const [day, records] of perDay) await call('PUT', 'attendance', { day, records });
    console.log(`  coach attendance: ${sessions.length} sessions`);
  }

  // Expenses
  if (data.expenses.some((e) => e.day.startsWith(month))) {
    console.log('  expenses already there, skipping');
  } else {
    const add = (day, category, amount, note = '', coach_id = '') =>
      call('POST', 'expenses', { day, category, amount, note, coach_id: coach_id ? String(coach_id) : '' });
    await add(`${month}-01`, 'Court rent', 6000, 'Indoor court, monthly');
    await add(`${month}-10`, 'Utilities', 1800, 'Electricity');
    await add(`${month}-15`, 'Water & snacks', 900);
    if (mi % 2 === 0) await add(`${month}-18`, 'Equipment', 2400, 'Balls and cones');
    for (const c of coaches.filter((c) => c.monthly_pay > 0)) await add(`${month}-03`, 'Coach pay', c.monthly_pay, `${c.name}, ${month}`, c.id);
    console.log('  expenses added');
  }
}
console.log('Done.');
