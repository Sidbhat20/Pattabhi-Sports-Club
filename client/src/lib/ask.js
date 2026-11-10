// The club assistant's answers. Every number is computed from the club data passed in.
// No AI is used. Context: { data, now (Date), today ('YYYY-MM-DD'), loadMonth (async month -> Map of 'day|type|id' -> status) }.
import { activeStudents, batchOf, billableFor, coachPaidIn, dueFor, netFor, sumBy } from './data.js';
import { dayLabel, monthLabel, rupees, shiftMonth } from './format.js';

export const EXAMPLES = ['Who is absent today?', 'Who still owes fees?', 'Coach pay this month', 'Expenses last month'];

const HINGLISH = { kitna: 'how much', kitne: 'how many', kitni: 'how many', baaki: 'owe', baki: 'owe', aaj: 'today', aj: 'today', kaun: 'who', pichle: 'last', mahine: 'month', mahina: 'month', saal: 'year', hai: '', hain: '', ka: '', ki: '', ke: '', kab: 'when' };
const FILLER = /\b(hi|hii|hello|hey|good morning|good afternoon|good evening|sir|madam|please|pls|plz|can you|could you|would you|tell me|kindly|ji|bhai|thanks|thank you|okay|ok)\b/g;
const MONTH_INDEX = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11, jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const WORDS = {
  attend: ['attendance', 'attendence', 'attend', 'attended', 'present', 'absent', 'came'],
  absent: ['absent', 'absentees'],
  student: ['students', 'student', 'studnets', 'studnet', 'children', 'kids', 'child'],
  owe: ['owe', 'owes', 'owing', 'due', 'pending', 'unpaid', 'remaining', 'baaki'],
  fees: ['fees', 'fee', 'fess', 'feez', 'fes'],
  collected: ['collected', 'collect', 'collection', 'received', 'income', 'earned'],
  expense: ['expense', 'expenses', 'spent', 'spend', 'spending', 'kharcha', 'cost', 'costs'],
  profit: ['profit', 'net', 'surplus', 'deficit'],
  coach: ['coach', 'coaches', 'trainer', 'trainers'],
  pay: ['pay', 'paid'],
  salary: ['salary', 'salaries'],
  schedule: ['schedule', 'timing', 'timings', 'timetable'],
  count: ['many', 'count', 'total', 'number'],
  record: ['record', 'recorded', 'recording'],
  send: ['send', 'sent'],
  message: ['message', 'messages', 'msg'],
  add: ['add'],
  list: ['list', 'names', 'show'],
  upi: ['upi'],
  cash: ['cash'],
};
const STOP = new Set([
  ...Object.values(WORDS).flat(), ...Object.keys(MONTH_INDEX),
  'how', 'much', 'does', 'about', 'find', 'what', 'who', 'when', 'the', 'and', 'are', 'this', 'last', 'month', 'year', 'for', 'of', 'to', 'in',
  'give', 'detail', 'details', 'status', 'me', 'we', 'our', 'do', 'have', 'with', 'from', 'is', 'was', 'did', 'by', 'on', 'at', 'it', 'that',
  'there', 'any', 'all', 'some', 'money', 'amount', 'balance', 'batch', 'batches', 'today', 'now', 'have', 'tell', 'find', 'show', 'give',
]);

const CATEGORY_WORDS = [
  [/court|rent|hall|ground/, 'Court rent'],
  [/coach/, 'Coach pay'],
  [/equip|ball|cone|kit/, 'Equipment'],
  [/travel|bus|fuel|transport|tournament/, 'Travel'],
  [/water|snack|tea/, 'Water & snacks'],
  [/electric|utilit|power/, 'Utilities'],
  [/market|advert|flex|poster/, 'Marketing'],
];
const categoryIn = (s) => (CATEGORY_WORDS.find(([re]) => re.test(s)) || [null, 'Other'])[1];
// A plain amount in the question (years and batch names are not amounts).
const numberIn = (s) => {
  const found = s.split(' ').filter((t) => /^\d{2,6}$/.test(t) && !/^20\d{2}$/.test(t));
  return found.length ? Number(found[0]) : null;
};
// Which action the message asks for, if any. Actions always ask for confirmation first.
const actionIntent = (tokens) => {
  if (has(tokens, 'send') && has(tokens, 'message')) return 'message';
  if (tokens.some((t) => ['mark', 'marks', 'marked'].includes(t))) return 'mark';
  if (has(tokens, 'record')) return 'payment';
  if (has(tokens, 'add') && has(tokens, 'expense')) return 'expense';
  return null;
};

// Builds the confirmation for an action. Nothing is written here; run() does the write when the user confirms.
function actionAnswer(kind, c) {
  const { question, stripped, tokens, data, period, ctx, studentHits, coachHits } = c;
  if (kind === 'mark') {
    const status = ['present', 'late', 'absent'].find((s) => tokens.includes(s));
    if (!status) return { text: 'Should I mark them present, late or absent? For example: "mark Arjun absent".' };
    const person = studentHits[0] ? { type: 'student', p: studentHits[0] } : coachHits[0] ? { type: 'coach', p: coachHits[0] } : null;
    if (!person) return { text: 'Who should I mark? For example: "mark Arjun absent today".' };
    const { type, p } = person;
    return {
      text: `Mark ${p.name} as ${status} for today, ${dayLabel(ctx.today)}?`,
      confirm: {
        yes: 'Yes, mark them',
        run: async (write) => {
          await write('PUT', 'attendance', { day: ctx.today, records: [{ person_type: type, person_id: p.id, status }] });
          return `Done. ${p.name} is marked ${status} for today.`;
        },
      },
    };
  }
  if (kind === 'payment') {
    const s = studentHits[0];
    if (!s) return { text: 'Which student paid? For example: "record payment for Arjun 1500 UPI".' };
    const m = period.months[0];
    const due = dueFor(data, s, m).balance;
    const amount = numberIn(stripped) ?? due;
    if (!amount) return { text: `${s.name} has nothing owing for ${monthLabel(m)}, so there is nothing to record.` };
    const found = /\bupi\b/.test(stripped) ? 'UPI' : /\bcash\b/.test(stripped) ? 'Cash' : /bank/.test(stripped) ? 'Bank transfer' : /\bcard\b/.test(stripped) ? 'Card' : null;
    const method = found || 'Cash';
    const note = found ? '' : ' No method was given, so it will be recorded as Cash.';
    return {
      text: `Record ${rupees(amount)} paid by ${method} from ${s.name} for ${monthLabel(m)}?${note}`,
      confirm: {
        yes: 'Yes, record it',
        run: async (write) => {
          await write('POST', 'payments', { student_id: String(s.id), amount, for_month: m, paid_on: ctx.today, method, note: '' });
          const left = Math.max(0, due - amount);
          return `Recorded ${rupees(amount)} from ${s.name} (${method}). ${left ? `${rupees(left)} still to pay for ${monthLabel(m)}.` : `Fully paid for ${monthLabel(m)}.`}`;
        },
      },
    };
  }
  if (kind === 'expense') {
    const amount = numberIn(stripped);
    if (!amount) return { text: 'How much was the expense? For example: "add expense 500 for equipment".' };
    const category = categoryIn(stripped);
    return {
      text: `Add an expense of ${rupees(amount)} under ${category}, dated ${dayLabel(ctx.today)}?`,
      confirm: {
        yes: 'Yes, add it',
        run: async (write) => {
          await write('POST', 'expenses', { day: ctx.today, category, amount, note: '', coach_id: '' });
          return `Added ${rupees(amount)} under ${category}.`;
        },
      },
    };
  }
  // message: only the three demo chats exist
  let chat = null;
  let who = null;
  if (studentHits[0]?.name.startsWith('Siddharth')) { chat = 'parent-siddharth'; who = 'the parent of Siddharth'; }
  else if (coachHits[0]?.name.startsWith('Shridhar')) { chat = 'coach-shridhar'; who = 'Shridhar'; }
  else if (/\bparents\b|\bgroup\b|pattabhi/.test(stripped)) { chat = 'parents-pattabhi'; who = "the parents' group"; }
  if (!chat) {
    return {
      text: "I can message the parents' group, Shridhar, or the parent of Siddharth. Which one?",
      chips: [
        { label: "Parents' group", send: 'Send a message to the parents group: ' },
        { label: 'Shridhar', send: 'Send a message to Shridhar: ' },
        { label: 'Parent of Siddharth', send: 'Send a message to the parent of Siddharth: ' },
      ],
    };
  }
  const m = question.match(/:\s*(.+)$/) || question.match(/\b(?:saying|that says|saying that|that)\s+(.+)$/i);
  const body = m ? m[1].trim() : '';
  if (!body) return { text: `Type the whole message, for example: "Send a message to ${who}: class cancelled today."` };
  return {
    text: `Send this to ${who}: "${body}"? It is saved in that chat. In this demo it is not sent to WhatsApp.`,
    confirm: {
      yes: 'Yes, send it',
      run: async (write) => {
        await write('POST', 'messages', { chat, body });
        return `Saved in the chat with ${who}.`;
      },
    },
  };
}

// Edit distance, so small typos still match.
const lev = (a, b) => {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
};

// Lower case, punctuation and "'s" removed, Hinglish mapped, "u 13" joined to "u13", filler kept until stripped.
export function normalize(text) {
  const s = text
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b([a-z]+)\s+(\d{1,2})\b/g, '$1$2')
    .trim();
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => HINGLISH[w] ?? w)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const near = (token, word) => token === word || (token.length >= 5 && lev(token, word) <= 1) || (token.length >= 8 && lev(token, word) <= 2);
const has = (tokens, key) => tokens.some((t) => WORDS[key].some((w) => near(t, w)));
const hasPhrase = (s, p) => ` ${s} `.includes(` ${p} `);

// A first name in the question, allowing a small typo. Common words never count as names.
function firstNameIn(tokens, name) {
  const first = normalize(name).split(' ')[0];
  if (first.length < 4) return tokens.includes(first);
  return tokens.some((t) => t.length >= 4 && !STOP.has(t) && (t === first || lev(t, first) <= (first.length >= 7 ? 2 : 1)));
}

// Which month or months the question asks about. Default: this month.
export function parsePeriod(s, now) {
  const pad = (n) => String(n).padStart(2, '0');
  const cur = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  if (/\b(last|previous|pichle) month\b/.test(s)) {
    const m = shiftMonth(cur, -1);
    return { months: [m], label: monthLabel(m), explicit: true };
  }
  if (/\b(this|current) year\b|\byear\b/.test(s) && !/\b20\d{2}\b/.test(s)) {
    const y = now.getFullYear();
    const months = Array.from({ length: now.getMonth() + 1 }, (_, i) => `${y}-${pad(i + 1)}`);
    return { months, label: `January to ${monthLabel(cur).split(' ')[0]} ${y}`, explicit: true };
  }
  const yearTok = s.match(/\b(20\d{2})\b/);
  for (const tok of s.split(' ')) {
    const idx = MONTH_INDEX[tok];
    if (idx === undefined) continue;
    if (tok === 'may' && !yearTok) continue;
    let y = yearTok ? Number(yearTok[1]) : now.getFullYear();
    if (!yearTok && idx > now.getMonth()) y -= 1;
    const m = `${y}-${pad(idx + 1)}`;
    return { months: [m], label: monthLabel(m), explicit: true };
  }
  return { months: [cur], label: monthLabel(cur), explicit: false };
}

const payStatus = (coach, paid, n) => {
  const target = coach.monthly_pay * n;
  if (!coach.monthly_pay) return 'no monthly pay set';
  if (paid >= target) return 'paid in full';
  if (paid > 0) return `${rupees(paid)} of ${rupees(target)} paid`;
  return 'not paid yet';
};

// Fees for a student in several months: the fee, what was paid, and what is still owed.
function periodDue(data, s, months) {
  return months.reduce(
    (t, m) => {
      if (s.joined_on && s.joined_on > `${m}-31`) return t;
      const d = dueFor(data, s, m);
      return { fee: t.fee + d.fee, paid: t.paid + d.paid, balance: t.balance + d.balance };
    },
    { fee: 0, paid: 0, balance: 0 },
  );
}

const sessionDays = (map) => new Set([...map.keys()].filter((k) => k.includes('|coach|')).map((k) => k.split('|')[0]));

async function coachAttendance(ctx, coach, months) {
  const maps = await Promise.all(months.map((m) => ctx.loadMonth(m)));
  let came = 0;
  let total = 0;
  maps.forEach((map) => {
    const days = sessionDays(map);
    total += days.size;
    came += [...days].filter((d) => ['present', 'late'].includes(map.get(`${d}|coach|${coach.id}`))).length;
  });
  return { came, total };
}

const sessionText = ({ came, total }) => (total ? `${came} of ${total} sessions` : 'no sessions recorded yet');

const FALLBACK = { text: "I didn't quite get that. Try one of these:", chips: EXAMPLES.map((e) => ({ label: e, send: e })) };

// Student lines for today, optionally one batch.
async function todayAttendance(ctx, data, batch) {
  const month = ctx.today.slice(0, 7);
  const map = await ctx.loadMonth(month);
  const billable = billableFor(data, month).filter((s) => !batch || s.batch_id === batch.id);
  let present = 0;
  let notMarked = 0;
  const absent = [];
  for (const s of billable) {
    const st = map.get(`${ctx.today}|student|${s.id}`);
    if (st === 'present' || st === 'late') present++;
    else if (st === 'absent') absent.push(s);
    else notMarked++;
  }
  const where = batch ? `${batch.name}, ` : '';
  const lines = [
    `${where}today, ${dayLabel(ctx.today)}: ${present} of ${billable.length} present`,
    `Absent: ${absent.length}`,
    `Not marked: ${notMarked}`,
  ];
  absent.slice(0, 12).forEach((s) => lines.push(`${s.name}: ${batchOf(data, s.batch_id)?.name || 'no batch'}`));
  if (absent.length > 12) lines.push(`and ${absent.length - 12} more`);
  return { text: lines.join('\n') };
}

function oweList(data, months, batch, label) {
  const owed = new Map();
  for (const m of months) {
    for (const s of billableFor(data, m)) {
      if (batch && s.batch_id !== batch.id) continue;
      const d = dueFor(data, s, m);
      if (d.balance > 0) owed.set(s.id, (owed.get(s.id) || 0) + d.balance);
    }
  }
  const rows = [...owed.entries()]
    .map(([id, bal]) => ({ s: data.students.find((x) => x.id === id), bal }))
    .sort((a, b) => b.bal - a.bal);
  const total = sumBy(rows, (r) => r.bal);
  const where = batch ? `${batch.name} ` : '';
  if (!rows.length) return { text: `Everyone ${batch ? `in ${batch.name} ` : ''}has paid for ${label}.` };
  const lines = [`${rows.length} ${where}students still owe ${rupees(total)} for ${label}:`];
  rows.slice(0, 8).forEach((r) => lines.push(`${r.s.name}: ${rupees(r.bal)} (${batchOf(data, r.s.batch_id)?.name || 'no batch'})`));
  if (rows.length > 8) lines.push(`and ${rows.length - 8} more`);
  return { text: lines.join('\n') };
}

function feeSummary(data, months, batch, label) {
  let billed = 0;
  let paid = 0;
  let balance = 0;
  let fullyPaid = 0;
  let count = 0;
  for (const m of months) {
    for (const s of billableFor(data, m)) {
      if (batch && s.batch_id !== batch.id) continue;
      const d = dueFor(data, s, m);
      billed += d.fee;
      paid += d.paid;
      balance += d.balance;
      count++;
      if (d.balance === 0) fullyPaid++;
    }
  }
  const where = batch ? `${batch.name}, ` : '';
  const lines = [`${where}fees for ${label}`, `Billed: ${rupees(billed)}`, `Collected: ${rupees(paid)}`, `Still to pay: ${rupees(balance)}`];
  if (months.length === 1) lines.push(`Fully paid: ${fullyPaid} of ${count} students`);
  return { text: lines.join('\n') };
}

function collectedSplit(data, months, label) {
  const rows = data.payments.filter((p) => months.some((m) => p.paid_on.startsWith(m)));
  const total = sumBy(rows, (p) => p.amount);
  const lines = [`Fees collected for ${label}: ${rupees(total)}`];
  for (const method of ['UPI', 'Cash']) {
    const sub = rows.filter((p) => p.method === method);
    lines.push(`${method}: ${rupees(sumBy(sub, (p) => p.amount))} (${new Set(sub.map((p) => p.student_id)).size} students)`);
  }
  const other = rows.filter((p) => p.method !== 'UPI' && p.method !== 'Cash');
  if (other.length) lines.push(`Other: ${rupees(sumBy(other, (p) => p.amount))} (${new Set(other.map((p) => p.student_id)).size} students)`);
  return { text: lines.join('\n') };
}

function expenseSummary(data, months, label) {
  const rows = data.expenses.filter((e) => months.some((m) => e.day.startsWith(m)));
  if (!rows.length) return { text: `No expenses recorded for ${label}.` };
  const byCat = {};
  rows.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
  const lines = [`Expenses for ${label}: ${rupees(sumBy(rows, (e) => e.amount))}`];
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => lines.push(`${c}: ${rupees(v)}`));
  return { text: lines.join('\n') };
}

function netAnswer(data, months, label) {
  const n = netFor(data, months);
  if (n.due > 0) {
    return {
      text: [
        label,
        `Net so far: ${rupees(n.net)} (fees collected minus expenses recorded)`,
        `Expected net after unpaid coach pay: ${rupees(n.net - n.due)} (${rupees(n.due)} still due to ${n.dueCoaches.join(', ')})`,
      ].join('\n'),
    };
  }
  return { text: [label, `Net: ${rupees(n.net)} (fees collected minus expenses)`].join('\n') };
}

async function coachAnswer(coach, ctx, period, tokens, stripped) {
  const { data } = ctx;
  const attendanceAsk = has(tokens, 'attend') || has(tokens, 'absent');
  const payAsk = has(tokens, 'pay') || has(tokens, 'salary');
  const paid = period.months.reduce((t, m) => t + coachPaidIn(data, coach.id, m), 0);
  const payLine = `Pay for ${period.label}: ${payStatus(coach, paid, period.months.length)}`;
  if (payAsk && !attendanceAsk) return { text: [`${coach.name}, ${period.label}`, payLine].join('\n') };
  if (period.explicit) {
    const att = await coachAttendance(ctx, coach, period.months);
    return { text: [`${coach.name}, ${period.label}`, `Attended: ${sessionText(att)}`, payLine].join('\n') };
  }
  const cur = await coachAttendance(ctx, coach, [period.months[0]]);
  const six = Array.from({ length: 6 }, (_, i) => shiftMonth(period.months[0], -i));
  const sixAtt = await coachAttendance(ctx, coach, six);
  const sixLine = sixAtt.total ? `${sixAtt.came} of ${sixAtt.total} sessions (${Math.round((sixAtt.came / sixAtt.total) * 100)}%)` : 'no sessions recorded yet';
  return {
    text: [
      `${coach.name}, ${period.label}`,
      `Attended this month: ${sessionText(cur)}`,
      `Last six months: ${sixLine}`,
      payLine,
    ].join('\n'),
  };
}

function studentAnswer(s, data, period, tokens, stripped) {
  const batch = batchOf(data, s.batch_id)?.name || 'no batch';
  const due = periodDue(data, s, period.months);
  if (has(tokens, 'owe') || has(tokens, 'pay') || /\bpaid\b/.test(stripped)) {
    const head = due.balance ? `${s.name} owes ${rupees(due.balance)} for ${period.label}.` : `${s.name} has paid in full for ${period.label}.`;
    return { text: [head, `Batch: ${batch}`, `Fee: ${rupees(due.fee)}`, `Paid: ${rupees(due.paid)}`, `Still to pay: ${rupees(due.balance)}`].join('\n') };
  }
  return {
    text: [
      `${s.name}, ${batch}`,
      `Parent: ${s.guardian_name || 'not recorded'}`,
      `Phone: ${s.guardian_phone || 'not recorded'}`,
      `Joined: ${s.joined_on ? dayLabel(s.joined_on) : 'not recorded'}`,
      `${period.label} paid: ${rupees(due.paid)}`,
      `${period.label} balance: ${due.balance ? `${rupees(due.balance)} to pay` : 'paid in full'}`,
    ].join('\n'),
  };
}

// Answer one question. Returns { text, chips? }. Chips are tappable follow-up questions.
export async function answer(question, ctx) {
  const { data, now } = ctx;
  const norm = normalize(question);
  const stripped = norm.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();

  if (!stripped) {
    if (/thank/.test(norm)) return { text: "You're welcome!" };
    if (/^(bye|goodbye|see you|good night)/.test(norm)) return { text: 'Goodbye! Have a great day.' };
    if (/^(hi|hii|hello|hey|good morning|good afternoon|good evening)/.test(norm)) {
      return { text: 'Hello! Ask me about students, batches, fees, coach pay, expenses or attendance.' };
    }
    return FALLBACK;
  }

  const tokens = stripped.split(' ');
  const period = parsePeriod(stripped, now);
  const batch = data.batches.find((b) => tokens.includes(normalize(b.name)));

  // People: students first, then coaches. Two students with the same first name are never guessed.
  const students = activeStudents(data);
  const fullStudents = students.filter((s) => hasPhrase(stripped, normalize(s.name)));
  const studentHits = fullStudents.length ? fullStudents : students.filter((s) => firstNameIn(tokens, s.name));
  const coaches = data.coaches.filter((c) => c.status === 'active');
  const fullCoaches = coaches.filter((c) => hasPhrase(stripped, normalize(c.name)));
  const coachHits = fullCoaches.length ? fullCoaches : coaches.filter((c) => firstNameIn(tokens, c.name));

  // A name the club does not have: say so, rather than answering for a different person.
  if (!batch && !studentHits.length && !coachHits.length && /how much does|owe|about|find|details|status|\bpaid\b|tell me/.test(stripped)) {
    // Capitalised words that are not command words: "Find Ritika Shetty" gives "Ritika Shetty".
    const cap = [...question.matchAll(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b/g)]
      .map((m) => m[0].split(' ').filter((w) => !STOP.has(w.toLowerCase())).join(' '))
      .find((w) => w);
    if (cap) return { text: `I could not find a student called ${cap}. Check the spelling, or try the first name.` };
  }

  if (studentHits.length > 1) {
    const first = normalize(studentHits[0].name).split(' ')[0];
    const firstShown = studentHits[0].name.split(' ')[0];
    return {
      text: `There are ${studentHits.length} students called ${firstShown}: ${studentHits.map((s) => `${s.name} (${batchOf(data, s.batch_id)?.name || 'no batch'})`).join(', ')}. Which one?`,
      chips: studentHits.map((s) => ({
        label: s.name,
        send: question.replace(new RegExp(`\\b${first}\\b`, 'i'), s.name) === question ? `${question} ${s.name}` : question.replace(new RegExp(`\\b${first}\\b`, 'i'), s.name),
      })),
    };
  }
  const act = actionIntent(tokens);
  if (act) return actionAnswer(act, { question, stripped, tokens, data, period, ctx, studentHits, coachHits });
  if (stripped === 'today') return todayAttendance(ctx, data, null);
  if (studentHits.length === 1) return studentAnswer(studentHits[0], data, period, tokens, stripped);
  if (coachHits.length >= 1) return coachAnswer(coachHits[0], ctx, period, tokens, stripped);

  if (has(tokens, 'profit')) return netAnswer(data, period.months, period.label);
  if (has(tokens, 'attend') || has(tokens, 'absent')) {
    if (has(tokens, 'coach')) {
      const lines = [`Coach attendance, ${period.label}`];
      for (const c of coaches) lines.push(`${c.name}: ${sessionText(await coachAttendance(ctx, c, period.months))}`);
      return { text: lines.join('\n') };
    }
    if (period.explicit) return { text: 'Student attendance is recorded day by day. Ask about today, for example: Who is absent today?' };
    return todayAttendance(ctx, data, batch);
  }
  if (has(tokens, 'expense')) return expenseSummary(data, period.months, period.label);
  if (/yet to pay|not paid|still to pay|who has not paid/.test(stripped) || has(tokens, 'owe')) {
    return oweList(data, period.months, batch, period.label);
  }
  if (has(tokens, 'collected') || has(tokens, 'upi') || has(tokens, 'cash')) return collectedSplit(data, period.months, period.label);
  if (has(tokens, 'fees')) return feeSummary(data, period.months, batch, period.label);
  if (has(tokens, 'coach') && has(tokens, 'pay') || has(tokens, 'salary')) {
    const lines = [`Coach pay for ${period.label}:`];
    for (const c of coaches) {
      const paid = period.months.reduce((t, m) => t + coachPaidIn(data, c.id, m), 0);
      lines.push(`${c.name}: ${payStatus(c, paid, period.months.length)}`);
    }
    return { text: lines.join('\n') };
  }
  if (batch && has(tokens, 'coach')) {
    const c = data.coaches.find((x) => x.id === batch.coach_id);
    return { text: c ? `${batch.name} is coached by ${c.name}.` : `No coach is set for ${batch.name}.` };
  }
  if (has(tokens, 'schedule')) {
    if (batch) return { text: `${batch.name} timings: ${batch.schedule || 'not set'}` };
    return { text: ['Batch timings:', ...data.batches.map((b) => `${b.name}: ${b.schedule || 'not set'}`)].join('\n') };
  }
  if (batch) {
    const members = activeStudents(data).filter((s) => s.batch_id === batch.id);
    let owed = 0;
    let owing = 0;
    for (const m of period.months) {
      for (const s of billableFor(data, m)) {
        if (s.batch_id !== batch.id) continue;
        const d = dueFor(data, s, m);
        if (d.balance > 0) {
          owed += d.balance;
          owing++;
        }
      }
    }
    const coach = data.coaches.find((c) => c.id === batch.coach_id);
    const lines = [
      `${batch.name}: ${members.length} students, fee ${rupees(batch.monthly_fee)} a month`,
      `Coach: ${coach?.name || 'none set'}`,
      `Schedule: ${batch.schedule || 'not set'}`,
    ];
    if (has(tokens, 'list')) members.sort((a, b) => a.name.localeCompare(b.name)).forEach((s) => lines.push(`${s.name}: ${batch.name}`));
    lines.push(`Still owing for ${period.label}: ${owing} students, ${rupees(owed)}`);
    return { text: lines.join('\n') };
  }
  if (has(tokens, 'student') || (has(tokens, 'count') && !has(tokens, 'pay'))) {
    const counts = data.batches.map((b) => ({ name: b.name, n: activeStudents(data).filter((s) => s.batch_id === b.id).length }));
    if (has(tokens, 'list')) {
      const sorted = [...activeStudents(data)].sort((a, b) => a.name.localeCompare(b.name));
      return { text: [`${sorted.length} active students:`, ...sorted.slice(0, 25).map((s) => `${s.name}: ${batchOf(data, s.batch_id)?.name || 'no batch'}`), ...(sorted.length > 25 ? [`and ${sorted.length - 25} more`] : [])].join('\n') };
    }
    return { text: [`We have ${activeStudents(data).length} active students.`, ...counts.map((c) => `${c.name}: ${c.n}`)].join('\n') };
  }
  return FALLBACK;
}
