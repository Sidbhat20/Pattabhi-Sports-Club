import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { PageHeader, Status } from '../components/ui.jsx';
import { WhatsAppIcon } from '../components/WhatsAppIcon.jsx';

// The chats shown on the WhatsApp screen. Keys match the chat field saved on each message.
const CHATS = [
  { key: 'parents-pattabhi', name: 'Parents of Pattabhi group', group: true, sub: 'Club notices for all parents' },
  { key: 'coach-shridhar', name: 'Shridhar', sub: 'Coach' },
  { key: 'parent-siddharth', name: 'Parent of Siddharth', sub: 'Parent · U13' },
];
const EMOJI = ['👍', '❤️', '😂', '🙏'];

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

// Each reaction counts once per person, so the chip shows the emoji and how many reacted.
function reactionChips(reactions) {
  const counts = new Map();
  reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1));
  return [...counts.entries()];
}

export function Messages({ data, show, live, demo }) {
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(CHATS[0].key);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    api('GET', 'messages').then(setMessages).catch((e) => show(e.message));
  }, [show, live.tick]);

  const threads = useMemo(
    () =>
      CHATS.map((c) => {
        const list = messages.filter((m) => m.chat === c.key);
        const last = list[list.length - 1];
        let unread = 0;
        for (let i = list.length - 1; i >= 0 && list[i].direction === 'in'; i--) unread++;
        return { ...c, list, last, unread };
      }),
    [messages],
  );
  const visible = threads.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const active = threads.find((c) => c.key === selected) ?? threads[0];

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [active?.key, active?.list.length]);

  const send = async (e) => {
    e?.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const row = await api('POST', 'messages', { chat: active.key, body: draft.trim() });
      setMessages((prev) => [...prev, row]);
      setDraft('');
    } catch (err) {
      show(err.message);
    } finally {
      setSending(false);
    }
  };

  const react = async (id, emoji) => {
    setPicking(null);
    try {
      const row = await api('POST', `messages/${id}/react`, { emoji });
      setMessages((prev) => prev.map((m) => (m.id === id ? row : m)));
    } catch (err) {
      show(err.message);
    }
  };

  let lastDay = null;
  return (
    <>
      <PageHeader title="WhatsApp" summary="Chats with parents and coaches">
        <Status tone="muted">Sample chats: replies are scripted, nothing is sent to WhatsApp</Status>
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
                <button type="button" className="wa-row" aria-current={active.key === c.key} onClick={() => setSelected(c.key)}>
                  <span className="wa-avatar">{c.group ? '👥' : initials(c.name)}</span>
                  <span className="wa-row-text">
                    <strong>{c.name}</strong>
                    <small>{c.last ? `${c.last.direction === 'out' ? 'You: ' : c.last.sender && c.group ? `${c.last.sender}: ` : ''}${c.last.body}` : c.sub}</small>
                  </span>
                  <span className="wa-row-meta">
                    {c.last && <small>{timeText(c.last.at)}</small>}
                    {c.unread > 0 && <span className="wa-unread">{c.unread}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="wa-phone" aria-label="Chat">
          <header className="wa-head">
            <span className="wa-avatar">{active.group ? '👥' : initials(active.name)}</span>
            <span>
              <strong>{active.name}</strong>
              <small>{active.sub}</small>
            </span>
          </header>
          <div className="wa-body" ref={bodyRef}>
            {active.list.map((m) => {
              const day = dayText(m.at);
              const separator = day !== lastDay ? <span className="wa-day">{day}</span> : null;
              lastDay = day;
              const chips = reactionChips(m.reactions || []);
              return (
                <div key={m.id} className="wa-item">
                  {separator}
                  <div className={`wa-bubble ${m.direction === 'out' ? 'out' : 'in'}`}>
                    {active.group && m.direction === 'in' && <span className="wa-sender">{m.sender}</span>}
                    <p>{m.body}</p>
                    <div className="wa-meta">
                      <button type="button" className="wa-react-btn" aria-label="React" onClick={() => setPicking(picking === m.id ? null : m.id)}>
                        ☺
                      </button>
                      <span>{timeText(m.at)}</span>
                      {m.direction === 'out' && <Ticks status={m.status} />}
                    </div>
                    {picking === m.id && (
                      <div className="wa-picker" role="group" aria-label="Choose a reaction">
                        {EMOJI.map((e) => (
                          <button key={e} type="button" onClick={() => react(m.id, e)}>
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {chips.length > 0 && (
                    <div className={`wa-reactions ${m.direction === 'out' ? 'out' : 'in'}`}>
                      {chips.map(([e, n]) => (
                        <span key={e} className="wa-react-chip">
                          {e} {n > 1 ? n : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!active.list.length && <p className="wa-empty">No messages yet. Say hello below.</p>}
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
        </section>
      </div>
    </>
  );
}
