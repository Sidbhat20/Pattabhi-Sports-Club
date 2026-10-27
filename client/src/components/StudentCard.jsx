import { useEffect, useRef } from 'react';
import { dueFor } from '../lib/data.js';
import { dayLabel, monthLabel, rupees, studentId, thisMonth } from '../lib/format.js';
import { Button } from './ui.jsx';

// Student card: ID, date of birth, name, parent's name and phone, joined date, and fees paid.
export function StudentCard({ student, data, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (student && !dialog.open) dialog.showModal();
    else if (!student && dialog.open) dialog.close();
  }, [student]);

  const month = thisMonth();
  const paid = student ? data.payments.filter((p) => p.student_id === student.id) : [];
  const totalPaid = paid.reduce((t, p) => t + p.amount, 0);
  const due = student ? dueFor(data, student, month) : null;

  return (
    <dialog ref={ref} className="dialog student-card" onClose={onClose} onCancel={onClose}>
      {student && (
        <>
          <div className="card-top">
            <div>
              <small>Student ID</small>
              <strong className="card-id">{studentId(student)}</strong>
            </div>
            <Button variant="text" size="small" onClick={() => ref.current.close()}>Close</Button>
          </div>
          <h2 className="card-name">{student.name}</h2>
          <dl className="card-grid">
            <dt>Date of birth</dt>
            <dd>{student.dob ? dayLabel(student.dob) : <span className="muted">Not recorded</span>}</dd>
            <dt>Parent / guardian</dt>
            <dd>{student.guardian_name || <span className="muted">Not recorded</span>}</dd>
            <dt>Parent phone</dt>
            <dd>{student.guardian_phone || <span className="muted">Not recorded</span>}</dd>
            <dt>Joined</dt>
            <dd>{student.joined_on ? dayLabel(student.joined_on) : <span className="muted">Not recorded</span>}</dd>
            <dt>Fees paid</dt>
            <dd>
              {rupees(totalPaid)} <span className="muted">across {paid.length} payments</span>
            </dd>
            <dt>{monthLabel(month)}</dt>
            <dd>{due.balance ? <span className="status status-due">{rupees(due.balance)} to pay</span> : <span className="status status-ok">Paid</span>}</dd>
          </dl>
        </>
      )}
    </dialog>
  );
}
