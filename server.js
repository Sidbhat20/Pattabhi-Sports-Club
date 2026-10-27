import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.dirname(fileURLToPath(import.meta.url));
// The React build. Run `npm run build` once before starting the server.
const publicDir = path.join(root, 'client', 'dist');
const dataDir = process.env.PSC_DATA || path.join(root, 'data');
const { PSC_USER, PSC_PASS } = process.env;
const port = process.env.PORT || 3000;

if (!PSC_USER || !PSC_PASS) {
  console.error('Set PSC_USER and PSC_PASS before starting the server.');
  process.exit(1);
}

mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'psc.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    monthly_pay INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT,
    coach_id INTEGER REFERENCES coaches(id),
    monthly_fee INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    dob TEXT,
    batch_id INTEGER REFERENCES batches(id),
    guardian_name TEXT,
    guardian_phone TEXT,
    emergency_phone TEXT,
    medical_notes TEXT,
    discount INTEGER NOT NULL DEFAULT 0,
    joined_on TEXT,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    person_type TEXT NOT NULL CHECK (person_type IN ('student', 'coach')),
    person_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent')),
    UNIQUE (day, person_type, person_id)
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    amount INTEGER NOT NULL,
    for_month TEXT NOT NULL,
    paid_on TEXT NOT NULL,
    method TEXT,
    note TEXT
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    coach_id INTEGER REFERENCES coaches(id)
  );
  CREATE TABLE IF NOT EXISTS punches (
    id INTEGER PRIMARY KEY,
    device_id TEXT,
    biometric_id TEXT NOT NULL,
    day TEXT NOT NULL,
    at TEXT NOT NULL,
    person_type TEXT,
    person_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    coach_id INTEGER NOT NULL REFERENCES coaches(id),
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    focus TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    phone TEXT NOT NULL,
    body TEXT NOT NULL,
    at TEXT NOT NULL,
    status TEXT
  );
`);
// Existing databases: add the biometric column where it is missing.
for (const table of ['students', 'coaches']) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes('biometric_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN biometric_id TEXT`);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message) => {
  throw new HttpError(400, message);
};

// Input rules: every write goes through these, so bad values never reach SQL.
const text = (max = 300) => (v) => {
  const s = String(v).trim();
  if (s.length > max) fail('Text is too long');
  return s;
};
const whole = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) fail('Amounts must be whole numbers');
  return n;
};
const pattern = (re, message) => (v) => {
  const s = String(v);
  if (!re.test(s)) fail(message);
  return s;
};
const day = pattern(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD');
const month = pattern(/^\d{4}-\d{2}$/, 'Months must be YYYY-MM');
const oneOf = (list) => (v) => (list.includes(v) ? v : fail('Invalid choice'));
const optional = (convert) => (v) => (v === '' || v == null ? null : convert(v));
const status = oneOf(['active', 'inactive']);
const ref = optional(whole);

const TABLES = {
  coaches: {
    required: ['name'],
    fields: { name: text(), phone: optional(text(20)), monthly_pay: whole, biometric_id: optional(text(40)), status },
  },
  batches: {
    required: ['name'],
    fields: {
      name: text(),
      schedule: optional(text()),
      coach_id: ref,
      monthly_fee: whole,
      status,
    },
  },
  students: {
    required: ['name'],
    fields: {
      name: text(),
      dob: optional(day),
      batch_id: ref,
      guardian_name: optional(text()),
      guardian_phone: optional(text(20)),
      emergency_phone: optional(text(20)),
      medical_notes: optional(text(1000)),
      discount: whole,
      joined_on: optional(day),
      biometric_id: optional(text(40)),
      status,
    },
  },
  payments: {
    required: ['student_id', 'amount', 'for_month', 'paid_on'],
    fields: {
      student_id: whole,
      amount: whole,
      for_month: month,
      paid_on: day,
      method: optional(text(30)),
      note: optional(text()),
    },
    deletable: true,
  },
  // What a coach is taking on court: which batch, and what they are working on.
  sessions: {
    required: ['day', 'coach_id', 'batch_id'],
    fields: { day, coach_id: whole, batch_id: whole, focus: optional(text(120)) },
    deletable: true,
  },
  expenses: {
    required: ['day', 'category', 'amount'],
    fields: {
      day,
      category: text(60),
      amount: whole,
      note: optional(text()),
      coach_id: ref,
    },
    deletable: true,
  },
};

const pick = (table, body, partial) => {
  const cfg = TABLES[table];
  for (const key of cfg.required) {
    if ((!partial || key in body) && (body[key] == null || body[key] === '')) {
      fail(`${key} is required`);
    }
  }
  const out = {};
  for (const [key, convert] of Object.entries(cfg.fields)) {
    if (key in body) out[key] = convert(body[key]);
  }
  if (!Object.keys(out).length) fail('Nothing to save');
  return out;
};

const write = (table, id, body) => {
  const values = pick(table, body, id !== undefined);
  const cols = Object.keys(values);
  if (id === undefined) {
    const info = db
      .prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...Object.values(values));
    return Number(info.lastInsertRowid);
  }
  const info = db
    .prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`)
    .run(...Object.values(values), id);
  if (!info.changes) throw new HttpError(404, 'Not found');
  return id;
};

const attendanceFor = (d) =>
  db.prepare('SELECT person_type, person_id, status FROM attendance WHERE day = ?').all(d);

const saveAttendance = (body) => {
  const d = day(body.day);
  if (!Array.isArray(body.records) || body.records.length > 1000) fail('Send up to 1000 records');
  db.exec('BEGIN');
  try {
    for (const r of body.records) {
      const type = oneOf(['student', 'coach'])(r.person_type);
      const personId = whole(r.person_id);
      if (!r.status) {
        db.prepare('DELETE FROM attendance WHERE day = ? AND person_type = ? AND person_id = ?').run(
          d,
          type,
          personId,
        );
      } else {
        db.prepare(
          `INSERT INTO attendance (day, person_type, person_id, status) VALUES (?, ?, ?, ?)
           ON CONFLICT (day, person_type, person_id) DO UPDATE SET status = excluded.status`,
        ).run(d, type, personId, oneOf(['present', 'late', 'absent'])(r.status));
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new HttpError(413, 'Request too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new HttpError(400, 'Bad JSON'));
      }
    });
  });

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const api = async (req, res, url) => {
  const [, , resource, rawId] = url.pathname.split('/');
  if (url.pathname === '/api/info') return send(res, 200, { demo: DEMO });
  if (url.pathname === '/api/events') return events(req, res);
  if (url.pathname === '/api/biometric/punch') return punch(req, res);
  if (url.pathname === '/api/whatsapp/webhook') return webhook(req, res, url);
  if (url.pathname === '/api/messages') return messagesApi(req, res);
  if (url.pathname === '/api/punches' && req.method === 'GET') {
    const d = day(url.searchParams.get('day') || '');
    return send(
      res,
      200,
      db
        .prepare(
          `SELECT p.day, p.at, p.person_type, p.person_id, p.biometric_id,
                  COALESCE(s.name, c.name, 'Unknown ID ' || p.biometric_id) AS name
           FROM punches p
           LEFT JOIN students s ON p.person_type = 'student' AND s.id = p.person_id
           LEFT JOIN coaches c ON p.person_type = 'coach' AND c.id = p.person_id
           WHERE p.day = ? ORDER BY p.at DESC LIMIT 200`,
        )
        .all(d),
    );
  }

  if (resource === 'data' && req.method === 'GET') {
    const all = {};
    for (const table of Object.keys(TABLES)) {
      all[table] = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
    }
    return send(res, 200, all);
  }

  if (resource === 'attendance') {
    if (req.method === 'GET') {
      const month = url.searchParams.get('month');
      if (month) {
        const m = pattern(/^\d{4}-\d{2}$/, 'Months must be YYYY-MM')(month);
        return send(res, 200, db.prepare('SELECT day, person_type, person_id, status FROM attendance WHERE day LIKE ?').all(`${m}-%`));
      }
      return send(res, 200, attendanceFor(day(url.searchParams.get('day') || '')));
    }
    if (req.method === 'PUT') {
      saveAttendance(await readBody(req));
      return send(res, 200, { ok: true });
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (!TABLES[resource]) throw new HttpError(404, 'Not found');
  const id = rawId === undefined ? undefined : Number(rawId);

  if (req.method === 'POST' && id === undefined) {
    const newId = write(resource, undefined, await readBody(req));
    return send(res, 201, db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(newId));
  }
  if (req.method === 'PUT' && Number.isInteger(id)) {
    write(resource, id, await readBody(req));
    return send(res, 200, db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(id));
  }
  if (req.method === 'DELETE' && Number.isInteger(id) && TABLES[resource].deletable) {
    const info = db.prepare(`DELETE FROM ${resource} WHERE id = ?`).run(id);
    if (!info.changes) throw new HttpError(404, 'Not found');
    return send(res, 200, { ok: true });
  }
  throw new HttpError(405, 'Method not allowed');
};

// Live updates: the server pushes events to every open screen over Server-Sent Events.
const OPEN_PATHS = new Set(['/api/biometric/punch', '/api/whatsapp/webhook']);
const clients = new Set();
const broadcast = (event) => {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(line);
};
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000).unref();

const events = (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(': connected\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
};

// Biometric terminal: POST { device_id, biometric_id, at? } with the X-Device-Key header.
const DEVICE_KEY = process.env.DEVICE_KEY;
const DEMO = process.env.PSC_DEMO === '1';
const punch = async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  if (!DEVICE_KEY || req.headers['x-device-key'] !== DEVICE_KEY) throw new HttpError(401, 'Bad device key');
  const body = await readBody(req);
  const bioId = String(body.biometric_id ?? '').trim();
  if (!bioId) fail('biometric_id is required');
  const at = body.at ? new Date(body.at) : new Date();
  if (Number.isNaN(at.getTime())) fail('at must be a date');
  const day = at.toLocaleDateString('en-CA');
  const student = db.prepare("SELECT id, name FROM students WHERE biometric_id = ? AND status = 'active'").get(bioId);
  const coach = student ? null : db.prepare("SELECT id, name FROM coaches WHERE biometric_id = ? AND status = 'active'").get(bioId);
  const person = student ? { type: 'student', ...student } : coach ? { type: 'coach', ...coach } : null;

  db.prepare('INSERT INTO punches (device_id, biometric_id, day, at, person_type, person_id) VALUES (?, ?, ?, ?, ?, ?)').run(
    String(body.device_id ?? ''),
    bioId,
    day,
    at.toISOString(),
    person?.type ?? null,
    person?.id ?? null,
  );
  if (person) {
    // A punch marks the person present only if nobody has set a status for that day yet.
    db.prepare(
      "INSERT INTO attendance (day, person_type, person_id, status) VALUES (?, ?, ?, 'present') ON CONFLICT (day, person_type, person_id) DO NOTHING",
    ).run(day, person.type, person.id);
    broadcast({ type: 'punch', day, person_type: person.type, person_id: person.id, name: person.name, at: at.toISOString() });
  } else {
    broadcast({ type: 'punch', day, person_type: null, name: `Unknown ID ${bioId}`, at: at.toISOString() });
  }
  send(res, 200, { matched: Boolean(person) });
};

// WhatsApp Cloud API. Meta calls the webhook; the signature is checked with the app secret.
const WA_APP_SECRET = process.env.WA_APP_SECRET;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;

const readRaw = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new HttpError(413, 'Request too large'));
      }
    });
    req.on('end', () => resolve(raw));
  });

const webhook = async (req, res, url) => {
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && WA_VERIFY_TOKEN && url.searchParams.get('hub.verify_token') === WA_VERIFY_TOKEN;
    if (!ok) throw new HttpError(403, 'Verification failed');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(url.searchParams.get('hub.challenge'));
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  if (!WA_APP_SECRET) throw new HttpError(503, 'WhatsApp is not configured');
  const raw = await readRaw(req);
  const expected = `sha256=${createHmac('sha256', WA_APP_SECRET).update(raw).digest('hex')}`;
  const given = String(req.headers['x-hub-signature-256'] || '');
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    throw new HttpError(401, 'Bad signature');
  }
  for (const entry of JSON.parse(raw).entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (m.type !== 'text') continue;
        const at = new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString();
        db.prepare("INSERT INTO messages (direction, phone, body, at, status) VALUES ('in', ?, ?, ?, 'received')").run(m.from, m.text.body, at);
        broadcast({ type: 'message', direction: 'in', phone: m.from });
      }
    }
  }
  res.writeHead(200);
  res.end('ok');
};

const messagesApi = async (req, res) => {
  if (req.method === 'GET') {
    return send(res, 200, db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all().reverse());
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const body = await readBody(req);
  let to = String(body.phone ?? '').replace(/\D/g, '');
  if (to.length === 10) to = `91${to}`;
  const msg = text(1000)(body.body ?? '');
  if (to.length < 12 || !msg) fail('Enter a phone number and a message');

  if (DEMO) {
    // Demo mode: the message is saved and shown, but nothing is sent to WhatsApp.
    const at = new Date().toISOString();
    const info = db.prepare("INSERT INTO messages (direction, phone, body, at, status) VALUES ('out', ?, ?, ?, 'demo')").run(to, msg, at);
    broadcast({ type: 'message', direction: 'out', phone: to });
    return send(res, 201, db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(info.lastInsertRowid)));
  }
  if (!WA_TOKEN || !WA_PHONE_ID) {
    throw new HttpError(503, 'WhatsApp is not connected yet. Add WA_TOKEN and WA_PHONE_ID on the server.');
  }

  const r = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: msg } }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, json.error?.message || 'WhatsApp rejected the message');

  const at = new Date().toISOString();
  const info = db.prepare("INSERT INTO messages (direction, phone, body, at, status) VALUES ('out', ?, ?, ?, 'sent')").run(to, msg, at);
  broadcast({ type: 'message', direction: 'out', phone: to });
  send(res, 201, db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(info.lastInsertRowid)));
};

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

const serveStatic = async (res, pathname) => {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = path.join(publicDir, path.normalize(rel));
  if (!file.startsWith(publicDir + path.sep)) throw new HttpError(404, 'Not found');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    throw new HttpError(404, 'Not found');
  }
};

const authorized = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const given = Buffer.from(header.slice(6), 'base64');
  const want = Buffer.from(`${PSC_USER}:${PSC_PASS}`);
  return given.length === want.length && timingSafeEqual(given, want);
};

// Branding and the Rive runtime hold no club data. Public so the install manifest can be fetched without login.
const PUBLIC_FILES = new Set([
  '/manifest.webmanifest',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/favicon-64.png',
  '/rive.wasm',
]);

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!PUBLIC_FILES.has(url.pathname) && !OPEN_PATHS.has(url.pathname) && !authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="PSC Dashboard"' });
    return res.end('Login required');
  }
  try {
    // CSRF guard: the browser login is sent automatically, so state-changing API calls must come from this site and send JSON.
    // Plain HTML forms cannot send application/json, and cross-site fetches with it trigger a preflight that is refused.
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && url.pathname.startsWith('/api/') && !OPEN_PATHS.has(url.pathname)) {
      const origin = req.headers.origin;
      let originHost = null;
      if (origin) {
        try {
          originHost = new URL(origin).host;
        } catch {
          originHost = null; // unreadable Origin counts as cross-site
        }
      }
      if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && originHost !== req.headers.host)) {
        return send(res, 403, { error: 'Cross-site request blocked' });
      }
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
        return send(res, 415, { error: 'Requests must be JSON' });
      }
    }
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await serveStatic(res, url.pathname);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    if (/FOREIGN KEY|UNIQUE/.test(err.message)) {
      return send(res, 400, { error: 'That record does not exist or is already saved' });
    }
    console.error(err);
    send(res, 500, { error: 'Something went wrong' });
  }
}).listen(port, () => console.log(`PSC dashboard running on http://localhost:${port}`));
