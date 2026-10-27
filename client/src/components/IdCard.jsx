import { batchOf, dueFor } from '../lib/data.js';
import { dayLabel, monthLabel, rupees, studentId, thisMonth } from '../lib/format.js';
import { Button } from './ui.jsx';

const ORANGE = '#ec7c1c';
const SEAM = '#2c2c2c';
const logo = '/logo.png';

// Basketball texture for the card, drawn as vector seams on the club's orange.
function BallArt({ className = '' }) {
  return (
    <svg className={`ball-art ${className}`} viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="300" height="200" fill={ORANGE} />
      <g fill="none" stroke={SEAM} strokeWidth="7" strokeLinecap="round">
        <path d="M150 -10 V210" />
        <path d="M-10 100 H310" />
        <path d="M30 -10 C90 60 90 140 30 210" />
        <path d="M270 -10 C210 60 210 140 270 210" />
      </g>
    </svg>
  );
}

function Silhouette() {
  return (
    <svg viewBox="0 0 100 120" className="silhouette" aria-label="Photo to be added" role="img">
      <rect width="100" height="120" fill="#d9d9d6" />
      <circle cx="50" cy="44" r="20" fill="#9c9c97" />
      <path d="M12 120 C14 84 30 72 50 72 C70 72 86 84 88 120 Z" fill="#9c9c97" />
    </svg>
  );
}

function Front({ student, batch }) {
  return (
    <div className="id-face id-front">
      <div className="id-main">
        <div className="id-photo">
          <Silhouette />
        </div>
        <div className="id-info">
          <strong className="id-name">{student.name}</strong>
          <div className="id-row">
            <small>Batch</small>
            <span>{batch}</span>
          </div>
          <div className="id-row">
            <small>ID</small>
            <span>{studentId(student)}</span>
          </div>
        </div>
      </div>
      <BallArt className="id-band" />
      <div className="id-logo-plate">
        <img src={logo} alt="Pattabhi Sports Club" />
        <span>Pattabhi Sports Club</span>
      </div>
    </div>
  );
}

function Back({ student, data }) {
  const month = thisMonth();
  const due = dueFor(data, student, month);
  const paid = data.payments.filter((p) => p.student_id === student.id).reduce((t, p) => t + p.amount, 0);
  const rows = [
    ['Date of birth', student.dob ? dayLabel(student.dob) : 'Not recorded'],
    ['Parent / guardian', student.guardian_name || 'Not recorded'],
    ['Parent phone', student.guardian_phone || 'Not recorded'],
    ['Joined', student.joined_on ? dayLabel(student.joined_on) : 'Not recorded'],
    ['Fees paid to date', rupees(paid)],
    [`${monthLabel(month)}`, due.balance ? `${rupees(due.balance)} to pay` : 'Paid'],
  ];
  return (
    <div className="id-face id-back">
      <BallArt className="id-back-art" />
      <div className="id-back-panel">
        <dl>
          {rows.map(([k, v]) => (
            <div key={k} className="id-back-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="id-back-logo">
        <img src={logo} alt="" />
        <span>Pattabhi Sports Club</span>
      </div>
    </div>
  );
}

// The card page opened in a new tab: front and back, with a print button for ID-card size.
export function IdCardPage({ data, id }) {
  const student = data.students.find((s) => s.id === Number(id));
  if (!student) {
    return (
      <div className="card-page">
        <p className="muted">No student with that ID.</p>
      </div>
    );
  }
  const batch = batchOf(data, student.batch_id)?.name || 'No batch';
  return (
    <div className="card-page">
      <div className="card-toolbar">
        <Button variant="primary" onClick={() => window.print()}>Print card</Button>
        <small className="muted">Prints the front and back at ID-card size.</small>
      </div>
      <div className="card-faces">
        <Front student={student} batch={batch} />
        <Back student={student} data={data} />
      </div>
    </div>
  );
}
