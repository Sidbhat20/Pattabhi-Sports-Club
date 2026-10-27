export const STATUS = [['active', 'Active'], ['inactive', 'Inactive']];
export const CATEGORIES = ['Court rent', 'Coach pay', 'Equipment', 'Travel', 'Water & snacks', 'Utilities', 'Marketing', 'Other'];
export const METHODS = ['Cash', 'UPI', 'Bank transfer', 'Card', 'Other'];

export const rupees = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const thisMonth = () => today().slice(0, 7);

export const shiftMonth = (m, delta) => {
  const [y, mo] = m.split('-').map(Number);
  return ymd(new Date(y, mo - 1 + delta, 1)).slice(0, 7);
};

export const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export const dayLabel = (s) =>
  new Date(`${s}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// wa.me needs digits with the country code. A 10-digit Indian number gets 91 added.
export function waLink(phone, message) {
  let n = String(phone || '').replace(/\D/g, '');
  if (n.length === 10) n = `91${n}`;
  else if (n.length === 11 && n.startsWith('0')) n = `91${n.slice(1)}`;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : '';
}

const greeting = (s) => s.guardian_name || 'there';
export const feeMessage = (s, balance, month) =>
  `Hi ${greeting(s)}, a friendly reminder from Pattabhi Sports Club. ${s.name}'s fee for ${monthLabel(month)} has ${rupees(balance)} pending. Please pay at your earliest. Thank you!`;
export const absentMessage = (s, day) =>
  `Hi ${greeting(s)}, ${s.name} was marked absent from Pattabhi Sports Club training on ${dayLabel(day)}. Please let us know if they will miss sessions. Thank you!`;
export const generalMessage = (s) =>
  `Hi ${greeting(s)}, this is Pattabhi Sports Club about ${s.name}.`;
