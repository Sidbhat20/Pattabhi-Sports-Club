import { activeStudents, batchOf, billableFor, coachPaidIn, dueFor, expensesIn, receivedIn, sumBy } from './data.js';
import { attendanceForMonth } from './api.js';
import { monthLabel, rupees, shiftMonth, thisMonth } from './format.js';

export const SUGGESTIONS = [
  'Who has not paid this month?',
  'How much was paid by UPI?',
  'Which coaches are paid this month?',
  'Tell me about U16',
  'What did we spend this month?',
  'Find Ritika Shetty',
];

// Answers computed from the club data on screen. No AI is involved.
export function localAnswer(question, data) {
  const m = thisMonth();
  const t = question.toLowerCase();
  const students = billableFor(data, m);
  const owing = students.map((s) => ({ s, ...dueFor(data, s, m) })).filter((x) => x.balance > 0).sort((a, b) => b.balance - a.balance);

  // A student by full name, or by first name.
  const active = activeStudents(data);
  // A full name we don't have is reported, not matched to someone with the same first name.
  const COMMAND_WORDS = /^(Find|Tell|Show|About|Who|Which|What|How|Check|Look)$/;
  const runs = question.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g) || [];
  const typedName = runs.map((r) => r.split(' ').filter((w) => !COMMAND_WORDS.test(w)).join(' ')).find((n) => n.includes(' '));
  const fullMatch = active.find((s) => t.includes(s.name.toLowerCase()));
  if (typedName && !fullMatch) return `I could not find a student called ${typedName}. Check the spelling or search by first name.`;
  const student = fullMatch || active.find((s) => t.split(/\s+/).includes(s.name.toLowerCase().split(' ')[0]));
  if (student) {
    const due = dueFor(data, student, m);
    const paid = data.payments.filter((p) => p.student_id === student.id && p.for_month === m).reduce((x, p) => x + p.amount, 0);
    const batch = batchOf(data, student.batch_id)?.name || 'no batch';
    return `${student.name}, ${batch}. Parent: ${student.guardian_name || 'not recorded'}, phone ${student.guardian_phone || 'not recorded'}. Joined ${student.joined_on || 'not recorded'}. ${monthLabel(m)}: paid ${rupees(paid)}, ${due.balance ? `${rupees(due.balance)} still to pay` : 'fully paid'}.`;
  }

  // A batch by name, such as U16
  const batch = data.batches.find((b) => t.includes(b.name.toLowerCase()));
  if (batch) {
    const members = activeStudents(data).filter((s) => s.batch_id === batch.id);
    const owingHere = owing.filter((x) => x.s.batch_id === batch.id);
    return `${batch.name}: ${members.length} students, fee ${rupees(batch.monthly_fee)} a month. ${owingHere.length} still owe ${rupees(sumBy(owingHere, (x) => x.balance))} for ${monthLabel(m)}.`;
  }

  if (/\bupi\b/.test(t) || /\bcash\b/.test(t)) {
    const method = /\bupi\b/.test(t) ? 'UPI' : 'Cash';
    const rows = receivedIn(data, m).filter((p) => p.method === method);
    return `${new Set(rows.map((p) => p.student_id)).size} students paid by ${method} this month, ${rupees(sumBy(rows, (p) => p.amount))} in all.`;
  }

  if (/coach/.test(t) && /paid|pay|salary/.test(t)) {
    const lines = data.coaches.filter((c) => c.status === 'active').map((c) => {
      const paid = coachPaidIn(data, c.id, m);
      if (!c.monthly_pay) return `${c.name}: no monthly pay set`;
      if (paid >= c.monthly_pay) return `${c.name}: paid in full`;
      if (paid > 0) return `${c.name}: ${rupees(paid)} of ${rupees(c.monthly_pay)} paid`;
      return `${c.name}: not paid yet`;
    });
    return `Coach pay for ${monthLabel(m)}:\n${lines.join('\n')}`;
  }

  if (/owe|unpaid|not paid|pending|yet to pay|still to pay|due/.test(t)) {
    const total = sumBy(owing, (x) => x.balance);
    const list = owing.slice(0, 8).map((x) => `${x.s.name}: ${rupees(x.balance)} (${batchOf(data, x.s.batch_id)?.name || 'no batch'})`);
    const more = owing.length > 8 ? `\nand ${owing.length - 8} more` : '';
    return owing.length ? `${owing.length} students still owe ${rupees(total)} for ${monthLabel(m)}:\n${list.join('\n')}${more}` : `Everyone has paid for ${monthLabel(m)}.`;
  }

  if (/spen|expense|cost/.test(t)) {
    const rows = expensesIn(data, m);
    const byCat = {};
    rows.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    const lines = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}: ${rupees(v)}`);
    return `Expenses for ${monthLabel(m)}: ${rupees(sumBy(rows, (e) => e.amount))}.\n${lines.join('\n') || 'No expenses recorded.'}`;
  }

  if (/income|collect|received|net|profit|surplus|deficit/.test(t)) {
    const income = sumBy(receivedIn(data, m), (p) => p.amount);
    const spent = sumBy(expensesIn(data, m), (e) => e.amount);
    return `For ${monthLabel(m)}: fees collected ${rupees(income)}, expenses ${rupees(spent)}, net ${rupees(income - spent)} (${income >= spent ? 'surplus' : 'deficit'}).`;
  }

  return null;
}

// Coach attendance: this month, and the last six months. Present and late both count as attended.
export async function attendanceAnswer(question, data) {
  const t = question.toLowerCase();
  if (!/attend|present|absent|came|sessions?/.test(t)) return null;
  const active = data.coaches.filter((c) => c.status === 'active');
  const coach = active.find((c) => t.includes(c.name.toLowerCase())) || active.find((c) => t.split(/\s+/).includes(c.name.toLowerCase().split(' ')[0]));
  if (!coach) return null;
  const m = thisMonth();
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(m, -i));
  const maps = await Promise.all(months.map((x) => attendanceForMonth(x)));
  let came = 0;
  let total = 0;
  let thisCame = 0;
  let thisTotal = 0;
  maps.forEach((map, i) => {
    const days = new Set([...map.keys()].filter((k) => k.includes('|coach|')).map((k) => k.split('|')[0]));
    const attended = [...days].filter((d) => ['present', 'late'].includes(map.get(`${d}|coach|${coach.id}`))).length;
    came += attended;
    total += days.size;
    if (i === 0) {
      thisCame = attended;
      thisTotal = days.size;
    }
  });
  if (!total) return `No coach attendance is recorded for ${coach.name} yet.`;
  const thisLine = thisTotal ? `${thisCame} of ${thisTotal} sessions` : `no sessions recorded yet`;
  return `${coach.name} this month (${monthLabel(m)}): ${thisLine}.\nLast six months: ${came} of ${total} sessions (${Math.round((came / total) * 100)}%).`;
}

// Everything the chat can answer, in order: attendance, club data, greetings, then a sorry reply.
export async function answerFor(question, data) {
  const attendance = await attendanceAnswer(question, data);
  if (attendance) return attendance;
  const fact = localAnswer(question, data);
  if (fact) return fact;
  const t = question.trim();
  const lower = t.toLowerCase();
  if (/^(hi|hii|hello|hey|good (morning|afternoon|evening))\b/.test(lower)) return 'Hello! Ask me about students, batches, fees, coach pay, spending, income or attendance.';
  if (/thank/.test(lower)) return "You're welcome!";
  if (/^(bye|goodbye|see you|good night)\b/.test(lower)) return 'Goodbye! Have a great day.';
  return "Sorry, I can't answer that yet. Try asking about students, batches, fees, coach pay, spending, income or attendance.";
}
