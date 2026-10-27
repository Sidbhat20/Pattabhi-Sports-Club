// Selectors over the full club dataset returned by GET /api/data.
export const activeStudents = (data) => data.students.filter((s) => s.status === 'active');
export const batchOf = (data, id) => data.batches.find((b) => b.id === id);
export const coachOf = (data, id) => data.coaches.find((c) => c.id === id);
export const byName = (a, b) => a.name.localeCompare(b.name);
const sum = (list, f) => list.reduce((t, x) => t + f(x), 0);
export const sumBy = sum;

// Fees are per student per month: the batch fee minus the student's discount.
export function dueFor(data, s, month) {
  const fee = Math.max(0, (batchOf(data, s.batch_id)?.monthly_fee || 0) - (s.discount || 0));
  const paid = sum(data.payments.filter((p) => p.student_id === s.id && p.for_month === month), (p) => p.amount);
  return { fee, paid, balance: Math.max(0, fee - paid) };
}

export const billableFor = (data, month) =>
  activeStudents(data).filter((s) => !s.joined_on || s.joined_on <= `${month}-31`);
export const receivedIn = (data, month) => data.payments.filter((p) => p.paid_on.startsWith(month));
export const expensesIn = (data, month) => data.expenses.filter((e) => e.day.startsWith(month));

// Coach pay is recorded as an expense in the "Coach pay" category, linked to the coach.
export const coachPaidIn = (data, coachId, month) =>
  sumBy(
    data.expenses.filter((e) => e.coach_id === coachId && e.category === 'Coach pay' && e.day.startsWith(month)),
    (e) => e.amount,
  );

// Last ten digits, so +91, 0 and spaces don't stop a number matching a saved contact.
export const lastTen = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);
