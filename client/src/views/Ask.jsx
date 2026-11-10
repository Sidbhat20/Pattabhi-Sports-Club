import { useEffect, useRef, useState } from 'react';
import { Button, PageHeader, Status } from '../components/ui.jsx';

const logo = '/logo.png';
const SORRY = "Sorry, I can't answer that. This is a demo version and is not production level yet.";
const QUESTION_START = /^(what|who|when|where|why|how|which|is|are|am|do|does|did|can|could|will|would|should|tell|show|find|list|give|explain)\b/i;

// Demo replies: questions get the sorry message, greetings and thanks get a normal answer.
export function replyTo(text) {
  const t = text.trim();
  const lower = t.toLowerCase();
  if (/\?$/.test(t) || QUESTION_START.test(t)) return SORRY;
  if (/^(hi|hii|hello|hey|good (morning|afternoon|evening))\b/.test(lower)) return 'Hello! Nice to meet you. I am the club assistant demo.';
  if (/thank/.test(lower)) return "You're welcome!";
  if (/^(bye|goodbye|see you|good night)\b/.test(lower)) return 'Goodbye! Have a great day.';
  return 'Got it.';
}

export function Ask() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const logRef = useRef(null);
  const boxRef = useRef(null);
  const timer = useRef(null);

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

  useEffect(() => () => clearTimeout(timer.current), []);

  const send = () => {
    const t = text.trim();
    if (!t || typing) return;
    setMessages((m) => [...m, { id: Date.now(), from: 'you', text: t }]);
    setText('');
    setTyping(true);
    const reply = replyTo(t);
    timer.current = setTimeout(() => {
      setMessages((m) => [...m, { id: Date.now() + 1, from: 'bot', text: reply }]);
      setTyping(false);
    }, 600 + Math.min(reply.length * 10, 800));
  };

  const newChat = () => {
    clearTimeout(timer.current);
    setMessages([]);
    setTyping(false);
    setText('');
  };

  return (
    <>
      <PageHeader title="Club assistant" summary="Chat with the club assistant">
        <Status tone="muted">Demo</Status>
        <Button variant="secondary" size="small" onClick={newChat}>New chat</Button>
      </PageHeader>

      <div className="gpt">
        <div className="gpt-log" ref={logRef} aria-live="polite">
          {!messages.length && (
            <div className="gpt-empty">
              <img src={logo} alt="" />
              <h2>How can I help?</h2>
              <p>Say hello, or type a message below.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`gpt-row ${m.from}`}>
              {m.from === 'bot' && (
                <span className="gpt-avatar" aria-hidden="true">
                  <img src={logo} alt="" />
                </span>
              )}
              <div className="gpt-bubble">{m.text}</div>
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
          <p className="gpt-foot">Demo only. Answers are not connected to the club's data yet.</p>
        </div>
      </div>
    </>
  );
}
