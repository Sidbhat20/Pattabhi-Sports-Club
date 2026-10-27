// Adds sample WhatsApp chats to the real dashboard:
//   - Parents of Pattabhi group (club notices, parents react)
//   - Shridhar (coach chat about bookings and money)
//   - Parent of Siddharth (absence and a late pickup)
// Also adds a sample student, Siddharth Menon, marked absent today.
// Safe to re-run. Nothing is sent to WhatsApp.
// Run with the server running:  PSC_USER=... PSC_PASS=... node scripts/sample-whatsapp.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.PSC_URL || 'http://localhost:3000';
const today = new Date().toLocaleDateString('en-CA');

async function call(method, p, body) {
  const res = await fetch(`${base}/api/${p}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p}: ${json.error || res.status}`);
  return json;
}

const db = new DatabaseSync(path.join(root, 'data', 'psc.db'));
if (db.prepare("SELECT COUNT(*) AS n FROM messages WHERE chat IS NOT NULL").get().n > 0) {
  console.log('Sample chats already exist. Nothing added.');
  db.close();
  process.exit(0);
}

// Sample student and today's absence
const data = await call('GET', 'data');
let sid = data.students.find((s) => s.name === 'Siddharth Menon')?.id;
if (!sid) {
  const u13 = data.batches.find((b) => b.name === 'U13');
  const created = await call('POST', 'students', {
    name: 'Siddharth Menon',
    batch_id: String(u13.id),
    guardian_name: 'Ananya Menon',
    guardian_phone: '',
    discount: 0,
    joined_on: '',
    biometric_id: '',
    status: 'active',
  });
  sid = created.id;
}
await call('PUT', 'attendance', { day: today, records: [{ person_type: 'student', person_id: sid, status: 'absent' }] });

// Chats: "out" is you, "in" is someone else. Times are minutes ago.
const chats = {
  'parents-pattabhi': [
    ['out', 'Class cancelled today due to rain. Sessions resume tomorrow at the usual time.', 200, 'You', [['Meera Bhat', '👍'], ['Divya Rao', '👍'], ['Lata Gowda', '🙏']]],
    ['in', 'Thank you for the update. Will the U13 batch also be cancelled?', 190, 'Meera Bhat', []],
    ['out', 'Yes, all batches are cancelled today, including U13.', 185, 'You', []],
    ['in', 'Noted, thank you.', 170, 'Prakash Shetty', []],
    ['out', 'Today is a holiday for all batches. No training, please plan accordingly.', 60, 'You', [['Divya Rao', '❤️'], ['Meera Bhat', '👍'], ['Prakash Shetty', '👍'], ['Lata Gowda', '😂']]],
    ['in', 'Thanks! Enjoy the break everyone.', 50, 'Lata Gowda', [['You', '🙏']]],
  ],
  'coach-shridhar': [
    ['in', 'Good morning. Is the U18 ground booked for Saturday 6 to 8 PM?', 480, 'Shridhar', []],
    ['out', 'Yes, booked and confirmed for Saturday 6 to 8 PM.', 470, 'You', []],
    ['in', 'Thanks. Can we settle the U18 kit money this week? ₹1,800 is pending from three families.', 120, 'Shridhar', []],
    ['out', "I'll review the list and share it by evening. Please send the names.", 110, 'You', []],
    ['in', 'Sure, sending the list now.', 100, 'Shridhar', []],
  ],
  'parent-siddharth': [
    ['in', 'Siddharth will be absent today, he has fever.', 240, 'Ananya Menon', []],
    ['out', "Sorry to hear that. We'll mark him absent today. Please let us know when he's better.", 230, 'You', []],
    ['in', 'I will come to pick up Siddharth late today around 7:30 PM. Is that okay?', 45, 'Ananya Menon', []],
    ['out', "Yes, that's fine. We'll keep him in the office until then.", 40, 'You', []],
  ],
};

const insert = db.prepare("INSERT INTO messages (direction, phone, body, at, status, chat, sender, reactions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
let count = 0;
for (const [chat, list] of Object.entries(chats)) {
  for (const [dir, body, minsAgo, sender, reacts] of list) {
    const at = new Date(Date.now() - minsAgo * 60000).toISOString();
    const reactions = reacts.map(([who, emoji]) => ({ who, emoji }));
    insert.run(dir === 'out' ? 'out' : 'in', chat, body, at, dir === 'out' ? 'demo' : 'received', chat, sender, JSON.stringify(reactions));
    count++;
  }
}
db.close();
console.log(`Added ${count} sample messages in 3 chats. Siddharth Menon is marked absent today.`);
