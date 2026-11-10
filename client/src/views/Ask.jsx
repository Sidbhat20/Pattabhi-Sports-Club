import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { MOCK } from '../lib/mock.js';
import { localAnswer, SUGGESTIONS } from '../lib/ask.js';
import { Button, PageHeader, Panel, Status } from '../components/ui.jsx';

export function Ask({ data }) {
  const [log, setLog] = useState([
    { from: 'bot', text: 'Ask me about students, batches, fees, coach pay or spending. Try a question below.' },
  ]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [log.length, busy]);

  const ask = async (question) => {
    const text = question.trim();
    if (!text || busy) return;
    setLog((l) => [...l, { from: 'you', text }]);
    setQ('');
    setBusy(true);
    let reply = null;
    let note = null;
    if (!MOCK) {
      try {
        reply = (await api('POST', 'ask', { question: text })).answer;
      } catch {
        note = 'The AI is not connected yet, so this answer comes from the club data on screen.';
      }
    }
    if (!reply) {
      await new Promise((r) => setTimeout(r, 600));
      reply = localAnswer(text, data);
    }
    setLog((l) => [...l, { from: 'bot', text: reply, note }]);
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Ask" summary="Ask about the club's students, fees, coaches and money">
        <Status tone="muted">{MOCK ? 'Demo: answers use sample data' : 'AI assistant'}</Status>
      </PageHeader>
      <Panel>
        <div className="ask-log">
          {log.map((m, i) => (
            <div key={i} className={`ask-msg ${m.from}`}>
              <p>{m.text}</p>
              {m.note && <small>{m.note}</small>}
            </div>
          ))}
          {busy && (
            <div className="ask-msg bot">
              <p className="muted">Looking that up…</p>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => ask(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
        <form
          className="ask-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question" aria-label="Question" />
          <Button type="submit" variant="primary" disabled={busy || !q.trim()}>Ask</Button>
        </form>
      </Panel>
    </>
  );
}
