// Mock mode: the whole app runs in the browser with sample data and no server.
// Enable with VITE_MOCK=true (npm run dev:mock). Replace these handlers with real API calls when the backend is connected.
export const MOCK = import.meta.env.VITE_MOCK === 'true';

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pad = (n) => String(n).padStart(2, '0');
const NOW = new Date();
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(NOW);
const monthsBack = (k) => ymd(new Date(NOW.getFullYear(), NOW.getMonth() - k, 1)).slice(0, 7);
const minutesAgo = (m) => new Date(NOW.getTime() - m * 60000).toISOString();
const sinceMidnight = NOW.getHours() * 60 + NOW.getMinutes();

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
const REPLIES = [
  'Thank you, noted.',
  'Okay, we will be there on time.',
  'Will he be able to make it tomorrow?',
  'Okay, I will send the fee this week.',
  'Thanks for the update.',
];

function buildData() {
  const data = { coaches: [], batches: [], students: [], payments: [], expenses: [], sessions: [] };
  const attendance = new Map(); // key: "day|type|id" -> status
  const punches = [];
  const messages = [];
  const attKey = (day, type, id) => `${day}|${type}|${id}`;

  COACHES.forEach(([name, pay], i) =>
    data.coaches.push({ id: i + 1, name, phone: `99998${pad(i + 1)}0001`, monthly_pay: pay, biometric_id: `C${i + 1}`, status: 'active' }),
  );
  BATCHES.forEach(([name, coach, fee, schedule], i) =>
    data.batches.push({ id: i + 1, name, schedule, coach_id: data.coaches.find((c) => c.name === coach).id, monthly_fee: fee, status: 'active' }),
  );

  const used = new Set();
  const personName = () => {
    for (;;) {
      const n = `${pick(FIRST)} ${pick(LAST)}`;
      if (!used.has(n)) return used.add(n) && n;
    }
  };
  const joinedOld = `${monthsBack(8)}-05`;
  const joinedNew = `${monthsBack(4)}-01`;
  let n = 0;
  data.batches.forEach((b, bi) => {
    const [lo, hi] = BATCHES[bi][4];
    for (let i = 0; i < 15; i++) {
      n++;
      const age = between(lo, hi);
      data.students.push({
        id: n,
        name: personName(),
        batch_id: b.id,
        dob: `${NOW.getFullYear() - age}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
        guardian_name: personName(),
        guardian_phone: `99999${String(n).padStart(5, '0')}`,
        emergency_phone: null,
        medical_notes: null,
        discount: n % 13 === 0 ? 200 : 0,
        joined_on: n > 52 ? joinedNew : joinedOld,
        biometric_id: String(1000 + n),
        status: 'active',
      });
    }
  });

  // Six months of fees, with a partly paid current month.
  let payId = 0;
  for (let k = 5; k >= 0; k--) {
    const month = monthsBack(k);
    for (const s of data.students) {
      if (s.joined_on > `${month}-31`) continue;
      const fee = Math.max(0, data.batches.find((b) => b.id === s.batch_id).monthly_fee - s.discount);
      const r = rnd();
      let amount;
      if (k > 0) amount = r < 0.82 ? fee : r < 0.92 ? Math.round(fee / 2) : 0;
      else amount = r < 0.55 ? fee : r < 0.65 ? Math.round(fee / 2) : 0;
      if (!amount) continue;
      const maxDay = k === 0 ? Math.min(24, NOW.getDate()) : 14;
      data.payments.push({
        id: ++payId,
        student_id: s.id,
        amount,
        for_month: month,
        paid_on: `${month}-${pad(Math.max(1, between(1, maxDay)))}`,
        method: pick(['UPI', 'UPI', 'Cash', 'Bank transfer']),
        note: null,
      });
    }
  }

  // Expenses: rent, utilities, equipment, travel, and monthly coach pay (one coach behind this month).
  let expId = 0;
  const addExpense = (day, category, amount, note = null, coach_id = null) => {
    if (!day || Number(day.slice(8)) > NOW.getDate() && day.startsWith(TODAY.slice(0, 7))) return;
    data.expenses.push({ id: ++expId, day, category, amount, note, coach_id });
  };
  for (let k = 5; k >= 0; k--) {
    const month = monthsBack(k);
    addExpense(`${month}-01`, 'Court rent', 6000, 'Indoor court, monthly');
    addExpense(`${month}-10`, 'Utilities', 1800, 'Electricity');
    addExpense(`${month}-15`, 'Water & snacks', 900);
    if (k % 2 === 0) addExpense(`${month}-18`, 'Equipment', 2400, 'Balls and cones');
    if (k === 3) addExpense(`${month}-20`, 'Travel', 3500, 'District tournament');
    for (const [cname, pay] of COACHES) {
      const coach = data.coaches.find((c) => c.name === cname);
      if (k === 0 && cname === 'Mahesh') continue;
      const partial = k === 0 && cname === 'Ranga';
      addExpense(`${month}-03`, 'Coach pay', partial ? Math.round(pay / 2) : pay, partial ? 'Part payment' : `${cname}, ${month}`, coach.id);
    }
  }

  // Attendance for the last 30 weekdays.
  for (let back = 30; back >= 1; back--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - back);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const day = ymd(d);
    data.students.forEach((s) => {
      const r = rnd();
      attendance.set(attKey(day, 'student', s.id), r < 0.82 ? 'present' : r < 0.9 ? 'late' : 'absent');
    });
    data.coaches.forEach((c) => attendance.set(attKey(day, 'coach', c.id), 'present'));
  }

  // Today: three absent by hand, the rest arrive through the biometric device.
  data.students.slice(0, 3).forEach((s) => attendance.set(attKey(TODAY, 'student', s.id), 'absent'));
  const punchable = data.students.slice(3, 40).filter(() => sinceMidnight > 10);
  punchable.forEach((s) => {
    const at = minutesAgo(between(5, Math.min(150, sinceMidnight - 5)));
    punches.push({ day: TODAY, at, person_type: 'student', person_id: s.id, biometric_id: s.biometric_id, name: s.name });
    if (!attendance.has(attKey(TODAY, 'student', s.id))) attendance.set(attKey(TODAY, 'student', s.id), 'present');
  });
  punches.sort((a, b) => b.at.localeCompare(a.at));

  // Chats: parents asking questions, and coaches checking the ground.
  let msgId = 0;
  const thread = (phone, script) =>
    script.forEach(([dir, body, mins]) =>
      messages.push({ id: ++msgId, direction: dir, phone, body, at: minutesAgo(mins), status: dir === 'in' ? 'received' : mins > 60 ? 'read' : 'delivered' }),
    );
  const parentPhone = (sid) => data.students.find((s) => s.id === sid).guardian_phone;
  thread(parentPhone(4), [
    ['in', 'Hi, will Arjun be able to attend tomorrow? He has a school exam in the morning.', 190],
    ['out', 'Hello, yes. Training is in the evening, so it is fine. Please let us know if it changes.', 180],
    ['in', 'Thank you. Also, when is the next fee due?', 42],
  ]);
  thread(parentPhone(9), [
    ['in', 'What is the fee for the U16 batch from next month?', 95],
    ['in', 'Also, do we get a receipt for UPI payments?', 93],
    ['out', 'Hello. U16 is ₹1,500 a month. Yes, every UPI payment gets a receipt from the office.', 70],
  ]);
  thread(parentPhone(21), [
    ['in', 'Our son has a cold. Will he be marked absent or can we just skip?', 25],
  ]);
  thread(parentPhone(33), [
    ['in', 'Is there a receipt for cash payments too?', 300],
    ['out', 'Yes. Ask at the front desk and we will write one.', 290],
  ]);
  thread(data.coaches[2].phone, [
    ['in', 'Can I take U18 at 7 tomorrow? The ground is booked for the league.', 120],
    ['out', 'Yes, go ahead. I will confirm the ground by evening.', 100],
  ]);

  const focusFor = { Sangeetha: 'Shooting', Mahesh: 'Dribbling', Shridhar: 'Pick and roll', Ranga: 'Footwork' };
  const batchFor = { Sangeetha: 'U16', Mahesh: 'U13', Shridhar: 'U18', Ranga: 'Juniors' };
  Object.keys(focusFor).forEach((cname, i) => {
    const coach = data.coaches.find((c) => c.name === cname);
    const batch = data.batches.find((b) => b.name === batchFor[cname]);
    data.sessions.push({ id: i + 1, day: TODAY, coach_id: coach.id, batch_id: batch.id, focus: focusFor[cname] });
    attendance.set(attKey(TODAY, 'coach', coach.id), 'present');
  });

  return { data, attendance, punches, messages, nextId: { messages: msgId } };
}

const store = buildData();
const listeners = new Set();
let timer = null;
const emit = (event) => listeners.forEach((fn) => fn(event));

// Live events in mock mode: a biometric punch about every 20 seconds, and replies to sent messages.
function randomPunch() {
  const students = store.data.students;
  const s = students[Math.floor(Math.random() * students.length)];
  const at = new Date().toISOString();
  const row = { day: TODAY, at, person_type: 'student', person_id: s.id, biometric_id: s.biometric_id, name: s.name };
  store.punches.unshift(row);
  store.attendance.set(`${TODAY}|student|${s.id}`, store.attendance.get(`${TODAY}|student|${s.id}`) || 'present');
  emit({ type: 'punch', ...row });
}

export function subscribeMock(fn) {
  listeners.add(fn);
  if (!timer) timer = setInterval(() => Math.random() < 0.3 && randomPunch(), 20000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const REF = new Set(['batch_id', 'coach_id', 'student_id']);
const NUMERIC = new Set(['monthly_pay', 'monthly_fee', 'discount', 'amount']);
const FIELDS = {
  coaches: ['name', 'phone', 'monthly_pay', 'biometric_id', 'status'],
  batches: ['name', 'schedule', 'coach_id', 'monthly_fee', 'status'],
  students: ['name', 'dob', 'batch_id', 'guardian_name', 'guardian_phone', 'emergency_phone', 'medical_notes', 'discount', 'joined_on', 'biometric_id', 'status'],
  payments: ['student_id', 'amount', 'for_month', 'paid_on', 'method', 'note'],
  expenses: ['day', 'category', 'amount', 'note', 'coach_id'],
  sessions: ['day', 'coach_id', 'batch_id', 'focus'],
};
const DEFAULTS = { coaches: { status: 'active' }, batches: { status: 'active' }, students: { status: 'active' } };
const DELETABLE = new Set(['payments', 'expenses', 'sessions']);

const coerce = (k, v) => {
  if (v === '' || v == null) return REF.has(k) || k === 'dob' || k === 'joined_on' ? null : NUMERIC.has(k) ? 0 : null;
  if (REF.has(k)) return Number(v);
  if (NUMERIC.has(k)) return Number(v) || 0;
  return String(v).trim();
};
const nextId = (table) => Math.max(0, ...store.data[table].map((r) => r.id)) + 1;

function writeRecord(table, id, body) {
  const row = id == null ? { id: nextId(table), ...(DEFAULTS[table] || {}) } : store.data[table].find((r) => r.id === id);
  if (!row) throw new Error('Not found');
  for (const k of FIELDS[table]) if (k in body) row[k] = coerce(k, body[k]);
  if (table === 'coaches' || table === 'students' || table === 'batches') {
    if (!row.name) throw new Error('name is required');
  }
  if (id == null) store.data[table].push(row);
  return row;
}

const reply = (phone) => {
  if (Math.random() < 0.8) {
    setTimeout(() => {
      const msg = {
        id: store.messages.length + 1000,
        direction: 'in',
        phone,
        body: pick(REPLIES),
        at: new Date().toISOString(),
        status: 'received',
      };
      store.messages.push(msg);
      emit({ type: 'message', direction: 'in', phone });
    }, 2500 + Math.random() * 2000);
  }
};

const sent = (phone, body) => {
  const row = { id: store.messages.length + 1000, direction: 'out', phone, body, at: new Date().toISOString(), status: 'sent' };
  store.messages.push(row);
  emit({ type: 'message', direction: 'out', phone });
  setTimeout(() => {
    row.status = 'delivered';
    emit({ type: 'message', direction: 'out', phone });
  }, 800);
  setTimeout(() => {
    row.status = 'read';
    emit({ type: 'message', direction: 'out', phone });
  }, 2500);
  reply(phone);
  return row;
};

export async function mockRequest(method, url, body) {
  const [path, qs] = url.split('?');
  const params = new URLSearchParams(qs || '');
  const [res, rawId] = path.split('/').filter(Boolean);
  const id = rawId === undefined ? undefined : Number(rawId);
  const clone = (x) => structuredClone(x);

  if (res === 'info') return { demo: true, mock: true };
  if (res === 'data' && method === 'GET') {
    return clone({ coaches: store.data.coaches, batches: store.data.batches, students: store.data.students, payments: store.data.payments, expenses: store.data.expenses });
  }
  if (res === 'attendance') {
    const day = params.get('day');
    if (method === 'GET') {
      const month = params.get('month');
      return [...store.attendance.entries()]
        .filter(([k]) => (month ? k.startsWith(`${month}-`) : k.startsWith(`${day}|`)))
        .map(([k, status]) => {
          const [dayPart, person_type, person_id] = k.split('|');
          return { day: dayPart, person_type, person_id: Number(person_id), status };
        });
    }
    if (method === 'PUT') {
      for (const r of body.records) {
        const key = `${body.day}|${r.person_type}|${r.person_id}`;
        if (r.status) store.attendance.set(key, r.status);
        else store.attendance.delete(key);
      }
      return { ok: true };
    }
  }
  if (res === 'punches' && method === 'GET') {
    return clone(store.punches.filter((p) => p.day === params.get('day')));
  }
  if (res === 'messages') {
    if (method === 'GET') return clone(store.messages);
    if (method === 'POST') {
      const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
      const text = String(body.body || '').trim();
      if (phone.length < 10 || !text) throw new Error('Enter a phone number and a message');
      return clone(sent(phone, text));
    }
  }
  if (store.data[res] && method === 'POST') return clone(writeRecord(res, null, body));
  if (store.data[res] && method === 'PUT' && id != null) return clone(writeRecord(res, id, body));
  if (store.data[res] && method === 'DELETE' && id != null && DELETABLE.has(res)) {
    store.data[res] = store.data[res].filter((r) => r.id !== id);
    return { ok: true };
  }
  throw new Error('Not available in mock mode');
}
