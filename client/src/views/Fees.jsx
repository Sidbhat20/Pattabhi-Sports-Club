import { useState } from 'react';
import { billableFor, batchOf, byName, dueFor } from '../lib/data.js';
import { dayLabel, monthLabel, rupees, shiftMonth } from '../lib/format.js';
import { Button, Empty, Ledger, PageHeader, Panel, Segmented, Status, Toolbar } from '../components/ui.jsx';

export function Fees({ data, ui, setUi, openForm, remove }) {
  const [filter, setFilter] = useState('unpaid');
  const month = ui.month;
  const all = billableFor(data, month).sort(byName).map((s) => ({ s, ...dueFor(data, s, month) }));
  const rows = all.filter((r) => filter === 'all' || (filter === 'unpaid' ? r.balance > 0 : r.balance === 0));
  const billed = all.reduce((t, r) => t + r.fee, 0);
  const paid = all.reduce((t, r) => t + r.paid, 0);
  const owing = all.filter((r) => r.balance > 0).length;
  const payments = data.payments.filter((p) => p.for_month === month).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const shift = (delta) => setUi({ ...ui, month: shiftMonth(month, delta) });
  const methodRows = (m) => data.payments.filter((p) => p.for_month === month && p.method === m);
  const sumMethod = (m) => methodRows(m).reduce((t, p) => t + p.amount, 0);
  const countMethod = (m) => new Set(methodRows(m).map((p) => p.student_id)).size;

  return (
    <>
      <PageHeader title="Fees" summary={`${monthLabel(month)}: ${all.length - owing} paid, ${owing} still to pay`}>
        <Button variant="secondary" size="small" onClick={() => shift(-1)} aria-label="Previous month">‹ Previous</Button>
        <Button variant="secondary" size="small" onClick={() => shift(1)} aria-label="Next month">Next ›</Button>
      </PageHeader>

      <Panel title="Totals">
        <Ledger
          rows={[
            { label: 'Billed', value: rupees(billed), note: `${all.length} students` },
            { label: 'Collected', value: rupees(paid), note: `${billed ? Math.min(100, Math.round((paid / billed) * 100)) : 0}% of billed` },
            { label: 'Paid by UPI', value: rupees(sumMethod('UPI')), note: `${countMethod('UPI')} students` },
            { label: 'Paid in cash', value: rupees(sumMethod('Cash')), note: `${countMethod('Cash')} students` },
            { label: 'Still to pay', value: rupees(billed - paid), note: `${owing} students` },
          ]}
        />
      </Panel>

      <Toolbar>
        <Segmented
          label="Show"
          options={[['unpaid', `Yet to pay (${owing})`], ['paid', `Paid (${all.length - owing})`], ['all', 'Everyone']]}
          value={filter}
          onChange={setFilter}
        />
      </Toolbar>

      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th className="num">Fee</th>
                <th className="num">Paid</th>
                <th className="num">Balance</th>
                <th className="actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.id}>
                  <td data-label="Student">
                    {r.s.name}
                    {r.s.discount ? <span className="muted"> · discount {rupees(r.s.discount)}</span> : null}
                  </td>
                  <td data-label="Batch">{batchOf(data, r.s.batch_id)?.name || 'No batch'}</td>
                  <td className="num" data-label="Fee">{rupees(r.fee)}</td>
                  <td className="num" data-label="Paid">{rupees(r.paid)}</td>
                  <td className="num" data-label="Balance">
                    {r.balance ? <Status tone="due">{rupees(r.balance)}</Status> : <Status tone="ok">Paid</Status>}
                  </td>
                  <td className="actions">
                    {r.balance > 0 && (
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => openForm('payments', null, { student_id: String(r.s.id), amount: r.balance, for_month: month })}
                      >
                        Record payment
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <Empty colSpan={6}>
                  {filter === 'unpaid' ? 'Nobody owes fees for this month.' : 'No students in this list.'}
                </Empty>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Payments in ${monthLabel(month)}`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Paid on</th>
                <th>Student</th>
                <th>Method</th>
                <th className="num">Amount</th>
                <th className="actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td data-label="Paid on">{dayLabel(p.paid_on)}</td>
                  <td data-label="Student">{data.students.find((s) => s.id === p.student_id)?.name || 'Unknown'}</td>
                  <td data-label="Method">{p.method || '—'}{p.note ? <span className="muted"> · {p.note}</span> : null}</td>
                  <td className="num" data-label="Amount">{rupees(p.amount)}</td>
                  <td className="actions">
                    <Button variant="text" size="small" onClick={() => remove('payments', p.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {!payments.length && <Empty colSpan={5}>No payments recorded this month.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
