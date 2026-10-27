// Fills blank sample details on the real dashboard:
//   - random 10-digit mobile numbers for parents (students) and coaches, where none is saved
//   - random joined dates in 2025, so every student joined before the 2026 fee history
// Existing values are not changed. Safe to re-run.
// Run with the server running:  node scripts/sample-profiles.mjs
const base = process.env.PSC_URL || 'http://localhost:3000';
let seed = 77;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pad = (n) => String(n).padStart(2, '0');
const mobile = () => `${6 + Math.floor(rnd() * 4)}${String(Math.floor(rnd() * 1e9)).padStart(9, '0')}`;
const joinedIn2025 = () => `2025-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`;

async function call(method, p, body) {
  const res = await fetch(`${base}/api/${p}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p}: ${json.error || res.status}`);
  return json;
}

const data = await call('GET', 'data');
let students = 0;
for (const s of data.students) {
  const patch = {};
  if (!s.guardian_phone) patch.guardian_phone = mobile();
  if (!s.joined_on) patch.joined_on = joinedIn2025();
  if (Object.keys(patch).length) {
    await call('PUT', `students/${s.id}`, patch);
    students++;
  }
}
let coaches = 0;
for (const c of data.coaches) {
  if (!c.phone) {
    await call('PUT', `coaches/${c.id}`, { phone: mobile() });
    coaches++;
  }
}
console.log(`Updated ${students} students and ${coaches} coaches.`);
