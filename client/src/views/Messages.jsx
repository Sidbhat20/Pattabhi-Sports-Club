import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { lastTen } from '../lib/data.js';
import { PageHeader, Status } from '../components/ui.jsx';
import { WhatsAppIcon } from '../components/WhatsAppIcon.jsx';

// Groups every message by the number's last ten digits, so each parent or coach is one chat.
function chatsFrom(messages, students, coaches) {
  const names = new Map();
  students.forEach((s) => s.guardian_phone && names.set(lastTen(s.guardian_phone), { name: `Parent of ${s.name}`, role: 'Parent' }));
  coaches.forEach((c) => c.phone && names.set(lastTen(c.phone), { name: c.name, role: 'Coach' }));
  const groups = new Map();
  messages.forEach((m) => {
    const key = lastTen(m.phone);
    if (!groups.has(key)) groups.set(key, { key, phone: m.phone, messages: [] });
    groups.get(key).messages.push(m);
  });
  return [...groups.values()]
    .map((g) => {
      const who = names.get(g.key) || { name: `+${g.phone}`, role: 'Contact' };
      const last = g.messages[g.messages.length - 1];
      let unread = 0;
      for (let i = g.messages.length - 1; i >= 0 && g.messages[i].direction === 'in'; i--) unread++;
      return { ...g, name: who.name, role: who.role, last, unread };
    })
    .sort((a, b) => b.last.id - a.last.id);
}

const initials = (name) =>
  name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

const timeText = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
function dayText(iso) {
  const d = new Date(iso);
  const t = new Date();
  const y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Ticks({ status }) {
  if (status === 'read') return <span className="ticks read" aria-label="Read">✓✓</span>;
  if (status === 'delivered') return <span className="ticks" aria-label="Delivered">✓✓</span>;
  if (status === 'sent' || status === 'demo') return <span className="ticks" aria-label="Sent">✓</span>;
  return null;
}

export function Messages({ data, show, live, demo }) {
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    api('GET', 'messages').then(setMessages).catch((e) => show(e.message));
  }, [show, live.tick]);

  const chats = useMemo(() => chatsFrom(messages, data.students, data.coaches), [messages, data]);
  const visible = chats.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const active = chats.find((c) => c.key === selected) ?? chats[0];
  const thread = active ? active.messages : [];

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [active?.key, thread.length]);

  const send = async (e) => {
    e?.preventDefault();
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    try {
      const row = await api('POST', 'messages', { phone: active.phone, body: draft.trim() });
      setMessages((prev) => [...prev, row]);
      setDraft('');
    } catch (err) {
      show(err.message);
    } finally {
      setSending(false);
    }
  };

  let lastDay = null;
  return (
    <>
      <PageHeader title="WhatsApp" summary="Chats with parents and coaches">
        <Status tone="muted">{demo ? 'Sample chats' : 'Sample messages until WhatsApp is connected'}</Status>
      </PageHeader>

      <div className="wa">
        <aside className="wa-list" aria-label="Chats">
          <div className="wa-list-head"><WhatsAppIcon size={18} /><strong>Chats</strong></div>
          <input
            type="search"
            className="wa-search"
            placeholder="Search chats"
            aria-label="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul>
            {visible.map((c) => (
              <li key={c.key}>
                <button type="button" className="wa-row" aria-current={active?.key === c.key} onClick={() => setSelected(c.key)}>
                  <span className="wa-avatar">{initials(c.name)}</span>
                  <span className="wa-row-text">
                    <strong>{c.name}</strong>
                    <small>{c.last.direction === 'out' ? 'You: ' : ''}{c.last.body}</small>
                  </span>
                  <span className="wa-row-meta">
                    <small>{timeText(c.last.at)}</small>
                    {c.unread > 0 && <span className="wa-unread">{c.unread}</span>}
                  </span>
                </button>
              </li>
            ))}
            {!visible.length && <li className="empty-row-li">No chats match.</li>}
          </ul>
        </aside>

        <section className="wa-phone" aria-label="Chat">
          {active ? (
            <>
              <header className="wa-head">
                <span className="wa-avatar">{initials(active.name)}</span>
                <span>
                  <strong>{active.name}</strong>
                  <small>{active.role} · +{active.phone.slice(0, 2)} {active.phone.slice(2)}</small>
                </span>
              </header>
              <div className="wa-body" ref={bodyRef}>
                {thread.map((m) => {
                  const day = dayText(m.at);
                  const separator = day !== lastDay ? <span className="wa-day" key={`d-${m.id}`}>{day}</span> : null;
                  lastDay = day;
                  return (
                    <div key={m.id} className="wa-item">
                      {separator}
                      <div className={`wa-bubble ${m.direction === 'out' ? 'out' : 'in'}`}>
                        <p>{m.body}</p>
                        <div className="wa-meta">
                          <span>{timeText(m.at)}</span>
                          {m.direction === 'out' && <Ticks status={m.status} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form className="wa-input" onSubmit={send}>
                <textarea
                  rows={1}
                  aria-label="Message"
                  placeholder="Type a message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button type="submit" className="wa-send" disabled={sending || !draft.trim()}>Send</button>
              </form>
            </>
          ) : (
            <p className="wa-empty">Select a chat to start.</p>
          )}
        </section>
      </div>
    </>
  );
}
