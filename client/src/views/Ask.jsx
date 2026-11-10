import { useEffect, useRef, useState } from 'react';
import { answer, EXAMPLES } from '../lib/ask.js';
import { attendanceForMonth } from '../lib/api.js';
import { today } from '../lib/format.js';

// Long answers are laid out as rows: a heading, then "label: value" lines, then an "and N more" note.
function Answer({ text }) {
  const lines = text.split('\n');
  const isList = lines.length > 2 && lines.slice(1).some((l) => l.includes(': ') || /^and \d+ more$/.test(l));
  if (!isList) return text.split('\n').map((l, i) => <p key={i}>{l}</p>);
  const [head, ...rest] = lines;
  return (
    <>
      <p className="gpt-head">{head}</p>
      <ul className="gpt-list">
        {rest.map((l, i) => {
          if (/^and \d+ more$/.test(l)) return <li key={i} className="gpt-more">{l}</li>;
          const k = l.lastIndexOf(': ');
          if (k < 0) return <li key={i}>{l}</li>;
          return (
            <li key={i}>
              <span>{l.slice(0, k)}</span>
              <b>{l.slice(k + 2)}</b>
            </li>
          );
        })}
      </ul>
    </>
  );
}
import { Button, PageHeader, Status } from '../components/ui.jsx';

const logo = '/logo.png';

export function Ask({ data }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const logRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, typing]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [text]);

  const send = async (preset) => {
    const t = (typeof preset === 'string' ? preset : text).trim();
    if (!t || typing) return;
    setMessages((m) => [...m, { id: Date.now(), from: 'you', text: t }]);
    setText('');
    setTyping(true);
    let res;
    try {
      res = await answer(t, { data, now: new Date(), today: today(), loadMonth: attendanceForMonth });
    } catch {
      res = { text: "Something went wrong while looking that up. Please try again." };
    }
    setMessages((m) => [...m, { id: Date.now() + 1, from: 'bot', text: res.text, chips: res.chips }]);
    setTyping(false);
  };

  return (
    <>
      <PageHeader title="Club assistant" summary="Ask about the club's students, fees, coaches and money">
        <Status tone="muted">Demo</Status>
        <Button variant="secondary" size="small" onClick={() => { setMessages([]); setText(''); setTyping(false); }}>New chat</Button>
      </PageHeader>

      <div className="gpt">
        <div className="gpt-log" ref={logRef} aria-live="polite">
          {!messages.length && (
            <div className="gpt-empty">
              <img src={logo} alt="" />
              <h2>How can I help?</h2>
              <p>Ask about a student, a batch, fees, coach pay, spending, income or attendance.</p>
              <div className="gpt-chips">
                {EXAMPLES.map((q) => (
                  <button key={q} type="button" className="gpt-chip" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`gpt-row ${m.from}`}>
              {m.from === 'bot' && (
                <span className="gpt-avatar" aria-hidden="true">
                  <img src={logo} alt="" />
                </span>
              )}
              <div className="gpt-bubble">
                <Answer text={m.text} />
                {m.chips && (
                  <div className="gpt-chips gpt-chips-inline">
                    {m.chips.map((c) => (
                      <button key={c.label + c.send} type="button" className="gpt-chip" onClick={() => send(c.send)}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {typing && (
            <div className="gpt-row bot">
              <span className="gpt-avatar" aria-hidden="true">
                <img src={logo} alt="" />
              </span>
              <div className="gpt-bubble">
                <span className="gpt-typing" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="gpt-composer">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              ref={boxRef}
              rows={1}
              value={text}
              placeholder="Message the club assistant"
              aria-label="Message"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" className="gpt-send" disabled={typing || !text.trim()} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12l16-8-6 16-2-7-8-1z" fill="currentColor" />
              </svg>
            </button>
          </form>
          <p className="gpt-foot">Demo: answers come from the club's sample data.</p>
        </div>
      </div>
    </>
  );
}
