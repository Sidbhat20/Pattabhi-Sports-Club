import { MOCK, mockRequest } from './mock.js';

export async function api(method, path, body) {
  if (MOCK) return mockRequest(method, path, body);
  const res = await fetch(`/api/${path}`, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong');
  return json;
}

// Attendance for one day, keyed by "student:12" / "coach:3".
export async function attendanceFor(day) {
  const rows = await api('GET', `attendance?day=${day}`);
  return new Map(rows.map((r) => [`${r.person_type}:${r.person_id}`, r.status]));
}

// Attendance for a whole month, keyed by "2026-10-03|coach|4".
export async function attendanceForMonth(month) {
  const rows = await api('GET', `attendance?month=${month}`);
  return new Map(rows.map((r) => [`${r.day}|${r.person_type}|${r.person_id}`, r.status]));
}
