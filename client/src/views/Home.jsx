import { useEffect, useState } from 'react';
import { api, attendanceFor } from '../lib/api.js';
import { batchOf, billableFor, coachPaidIn, dueFor, expensesIn, receivedIn, sumBy } from '../lib/data.js';
import { absentMessage, dayLabel, feeMessage, monthLabel, rupees, thisMonth, today } from '../lib/format.js';
import { Button, Empty, Ledger, PageHeader, Panel, Status } from '../components/ui.jsx';
import { Contact } from '../components/Contact.jsx';

export function Home({ data, show, live, openForm }) {
  const month = thisMonth();
  const day = today();
  const [att, setAtt] = useState(new Map());
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    attendanceFor(day).then(setAtt).catch((e) => show(e.message));
    api('GET', 'messages').then((rows) => setMessages(rows.slice(-3).reverse())).catch(() => {});
  }, [day, show, live.tick]);

  const students = billableFor(data, month);
  const statusOf = (s) => att.get(`student:${s.id}`);
  const marked = students.filter((s) => statusOf(s));
  const absent = students.filter((s) => statusOf(s) === 'absent');
  const present = marked.length - absent.length;
  const unmarked = students.length - marked.length;
  const received = sumBy(receivedIn(data, month), (p) => p.amount);
  const spent = sumBy(expensesIn(data, month), (e) => e.amount);
  const owing = students
    .map((s) => ({ s, ...dueFor(data, s, month) }))
    .filter((x) => x.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const pendingTotal = sumBy(owing, (x) => x.balance);
  const coaches = data.coaches.filter((c) => c.status === 'active' && c.monthly_pay > 0);
  const coachesPaid = coaches.filter((c) => coachPaidIn(data, c.id, month) >= c.monthly_pay).length;
  const lastPunch = live.punches[0];

  return (
    <>
      <PageHeader title="Home" summary={`${dayLabel(day)} · ${monthLabel(month)}`}>
        <Status tone={live.connected ? 'ok' : 'muted'}>{live.connected ? 'Live' : 'Reconnecting'}</Status>
      </PageHeader>

      <Panel title="Today">
        <Ledger
          rows={[
            { label: 'Students present', value: `${present} of ${students.length}`, note: `${absent.length} absent · ${unmarked} not marked yet` },
            { label: 'Attendance rate', value: marked.length ? `${Math.round((present / marked.length) * 100)}%` : '—', note: 'Of those marked today' },
            { label: 'Last biometric punch', value: lastPunch ? lastPunch.name : '—', note: lastPunch ? new Date(lastPunch.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Waiting for the device' },
          ]}
        />
      </Panel>

      <Panel
        title="Coaches today"
        action={
          <Button variant="primary" size="small" onClick={() => openForm('sessions', null, { day })}>
            Log a session
          </Button>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Coach</th>
                <th>Today</th>
                <th>Batch and focus</th>
              </tr>
            </thead>
            <tbody>
              {data.coaches
                .filter((c) => c.status === 'active')
                .map((c) => {
                  const mine = data.sessions.filter((x) => x.day === day && x.coach_id === c.id);
                  // A logged session is what puts a coach on court today.
                  return (
                    <tr key={c.id}>
                      <td data-label="Coach">{c.name}</td>
                      <td data-label="Today">
                        <Status tone={mine.length ? 'ok' : 'muted'}>{mine.length ? 'Present' : 'Not logged'}</Status>
                      </td>
                      <td data-label="Batch and focus">
                        {mine.length ? (
                          mine.map((x) => (
                            <div key={x.id}>
                              {batchOf(data, x.batch_id)?.name || 'Batch'}
                              {x.focus ? <span className="muted"> · {x.focus}</span> : null}
                            </div>
                          ))
                        ) : (
                          <span className="muted">No session logged</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Money, ${monthLabel(month)}`}>
        <Ledger
          rows={[
            { label: 'Fees collected', value: rupees(received), note: `${receivedIn(data, month).length} payments` },
            { label: 'Fees still owed', value: rupees(pendingTotal), note: `${owing.length} students` },
            { label: 'Expenses', value: rupees(spent), note: `${expensesIn(data, month).length} entries` },
            { label: 'Net', value: rupees(received - spent), note: received - spent >= 0 ? 'Surplus' : 'Deficit' },
            { label: 'Coaches paid', value: `${coachesPaid} of ${coaches.length}`, note: 'Full monthly pay recorded' },
          ]}
        />
      </Panel>

      <div className="grid2">
        <Panel title="Fees to follow up">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="num">Owed</th>
                  <th className="actions">Contact</th>
                </tr>
              </thead>
              <tbody>
                {owing.slice(0, 6).map((x) => (
                  <tr key={x.s.id}>
                    <td data-label="Student">
                      {x.s.name}
                      <div className="muted small">{batchOf(data, x.s.batch_id)?.name || 'No batch'}</div>
                    </td>
                    <td className="num due" data-label="Owed">{rupees(x.balance)}</td>
                    <td className="actions">
                      <Contact phone={x.s.guardian_phone} message={feeMessage(x.s, x.balance, month)} />
                    </td>
                  </tr>
                ))}
                {!owing.length && <Empty colSpan={3}>Everyone has paid this month.</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Absent today">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="actions">Contact</th>
                </tr>
              </thead>
              <tbody>
                {absent.slice(0, 6).map((s) => (
                  <tr key={s.id}>
                    <td data-label="Student">
                      {s.name}
                      <div className="muted small">{batchOf(data, s.batch_id)?.name || 'No batch'}</div>
                    </td>
                    <td className="actions">
                      <Contact phone={s.guardian_phone} message={absentMessage(s, day)} />
                    </td>
                  </tr>
                ))}
                {!absent.length && <Empty colSpan={2}>No absences marked today.</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Latest messages" action={<a className="quiet" href="#whatsapp">Open messages</a>}>
        <ul className="plain-list">
          {messages.map((m) => (
            <li key={m.id}>
              <span className="muted">{m.direction === 'in' ? 'From' : 'To'} {m.phone}</span> · {m.body}
            </li>
          ))}
          {!messages.length && <li className="muted">No messages yet. Replies from parents appear here.</li>}
        </ul>
      </Panel>
    </>
  );
}

