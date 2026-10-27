import { CATEGORIES, METHODS, STATUS, today } from './format.js';
import { activeStudents, byName } from './data.js';

const opts = (list, label, blank) => [
  ...(blank ? [['', blank]] : []),
  ...list.map((r) => [String(r.id), r[label]]),
];

// Field specs for every add/edit dialog. Each returns { title, defaults, fields }.
export const specs = {
  students: (data, record) => ({
    title: record ? 'Edit student' : 'Add student',
    defaults: { status: 'active', joined_on: today() },
    fields: [
      { name: 'name', label: 'Full name', required: true },
      { name: 'batch_id', label: 'Batch', type: 'select', options: opts(data.batches, 'name', 'No batch') },
      { name: 'guardian_name', label: 'Parent / guardian name' },
      { name: 'guardian_phone', label: 'Parent WhatsApp number', type: 'tel' },
      { name: 'emergency_phone', label: 'Emergency phone', type: 'tel' },
      { name: 'dob', label: 'Date of birth', type: 'date' },
      { name: 'joined_on', label: 'Joined on', type: 'date' },
      { name: 'biometric_id', label: 'Biometric ID', placeholder: 'The ID number on the fingerprint device' },
      { name: 'discount', label: 'Monthly discount (₹)', type: 'number', min: 0 },
      { name: 'medical_notes', label: 'Medical notes / allergies', type: 'textarea' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS },
    ],
  }),
  coaches: (data, record) => ({
    title: record ? 'Edit coach' : 'Add coach',
    defaults: { status: 'active' },
    fields: [
      { name: 'name', label: 'Full name', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'monthly_pay', label: 'Monthly pay (₹)', type: 'number', min: 0 },
      { name: 'biometric_id', label: 'Biometric ID', placeholder: 'The ID number on the fingerprint device' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS },
    ],
  }),
  batches: (data, record) => ({
    title: record ? 'Edit batch' : 'Add batch',
    defaults: { status: 'active' },
    fields: [
      { name: 'name', label: 'Batch name', required: true },
      { name: 'schedule', label: 'Schedule', placeholder: 'Mon, Wed, Fri 6:00–7:30 PM' },
      { name: 'coach_id', label: 'Coach', type: 'select', options: opts(data.coaches, 'name', 'No coach') },
      { name: 'monthly_fee', label: 'Monthly fee (₹)', type: 'number', min: 0 },
      { name: 'status', label: 'Status', type: 'select', options: STATUS },
    ],
  }),
  payments: (data, record, month) => ({
    title: 'Record payment',
    defaults: { paid_on: today(), for_month: month, method: 'Cash' },
    fields: [
      { name: 'student_id', label: 'Student', type: 'select', required: true, options: opts(activeStudents(data).sort(byName), 'name') },
      { name: 'amount', label: 'Amount (₹)', type: 'number', min: 0, required: true },
      { name: 'for_month', label: 'Fee for month', type: 'month', required: true },
      { name: 'paid_on', label: 'Date paid', type: 'date', required: true },
      { name: 'method', label: 'Method', type: 'select', options: METHODS.map((m) => [m, m]) },
      { name: 'note', label: 'Note' },
    ],
  }),
  sessions: (data, record, month, extra) => ({
    title: 'Log a coach session',
    defaults: { day: today() },
    fields: [
      { name: 'day', label: 'Date', type: 'date', required: true },
      { name: 'coach_id', label: 'Coach', type: 'select', required: true, options: opts(data.coaches.filter((c) => c.status === 'active'), 'name', 'Choose a coach') },
      { name: 'batch_id', label: 'Batch taken', type: 'select', required: true, options: opts(data.batches, 'name', 'Choose a batch') },
      { name: 'focus', label: 'What they are working on', placeholder: 'e.g. Shooting, Dribbling, Defence' },
    ],
  }),
  expenses: (data) => ({
    title: 'Add expense',
    defaults: { day: today() },
    fields: [
      { name: 'day', label: 'Date', type: 'date', required: true },
      { name: 'category', label: 'Category', type: 'select', required: true, options: CATEGORIES.map((c) => [c, c]) },
      { name: 'amount', label: 'Amount (₹)', type: 'number', min: 0, required: true },
      { name: 'coach_id', label: 'Coach (for coach pay)', type: 'select', options: opts(data.coaches, 'name', 'None') },
      { name: 'note', label: 'Note' },
    ],
  }),
};
