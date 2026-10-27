import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export function Button({ variant = 'secondary', size, className = '', ...props }) {
  return <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`.trim()} {...props} />;
}

export function LinkButton({ variant = 'secondary', size, className = '', ...props }) {
  return <a className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`.trim()} {...props} />;
}

// Mutually exclusive choices: connected segments, one selected.
export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function Status({ tone = 'muted', children }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function PageHeader({ title, summary, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {summary && <p className="summary">{summary}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}

export function Panel({ title, action, children }) {
  return (
    <section className="panel">
      {(title || action) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Label and value rows, used for period totals.
export function Ledger({ rows }) {
  return (
    <div className="table-wrap">
      <table className="ledger">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="num" data-label={r.label}>{r.value}</td>
              <td className="muted">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({ colSpan, children }) {
  return (
    <tr className="empty-row">
      <td colSpan={colSpan}>{children}</td>
    </tr>
  );
}

export function useToast() {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  // Stable identity: views and App list it as an effect dependency, so a new function would re-fetch on every render.
  const show = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { message, show };
}

export function Toast({ message }) {
  const ref = useRef(null);
  useEffect(() => {
    if (message && ref.current) gsap.fromTo(ref.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power1.out' });
  }, [message]);
  if (!message) return null;
  return (
    <div ref={ref} className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
