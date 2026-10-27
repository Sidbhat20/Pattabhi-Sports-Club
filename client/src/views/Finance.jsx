import { useState } from 'react';
import { coachPaidIn, expensesIn, receivedIn, sumBy } from '../lib/data.js';
import { dayLabel, monthLabel, rupees, shiftMonth } from '../lib/format.js';
import { Button, Empty, Ledger, PageHeader, Panel, Segmented, Status, Toolbar } from '../components/ui.jsx';

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'short' }),
);

function coachStatus(paid, pay) {
  if (!pay) return { tone: 'muted', text: 'No pay set' };
  if (paid >= pay) return { tone: 'ok', text: 'Paid' };
  if (paid > 0) return { tone: 'due', text: `${rupees(pay - paid)} to pay` };
  return { tone: 'due', text: 'Not paid' };
}

export function Finance({ data, ui, setUi, openForm, remove }) {
  const [period, setPeriod] = useState('month');
  const month = ui.month;
  const year = month.slice(0, 4);
  const shift = (delta) => setUi({ ...ui, month: shiftMonth(month, delta) });
  const shiftYear = (delta) => setUi({ ...ui, month: `${Number(year) + delta}-${month.slice(5)}` });
  const activeCoaches = data.coaches.filter((c) => c.status === 'active');

  if (period === 'year') {
    const months = MONTH_NAMES.map((name, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      const income = sumBy(receivedIn(data, key), (p) => p.amount);
      const spent = sumBy(expensesIn(data, key), (e) => e.amount);
      return { key, name, income, spent, net: income - spent };
    });
    const totalIn = sumBy(months, (m) => m.income);
    const totalOut = sumBy(months, (m) => m.spent);
    const coachYear = activeCoaches.map((c) => ({
      c,
      paid: sumBy(
        Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
        (k) => coachPaidIn(data, c.id, k),
      ),
    }));

    return (
      <>
        <PageHeader title="Finance" summary={`Full year ${year}: money in and out, month by month`}>
          <Button variant="secondary" size="small" onClick={() => shiftYear(-1)} aria-label="Previous year">‹ {Number(year) - 1}</Button>
          <Button variant="secondary" size="small" onClick={() => shiftYear(1)} aria-label="Next year">{Number(year) + 1} ›</Button>
        </PageHeader>
        <Toolbar>
          <Segmented label="Period" options={[['month', 'Month'], ['year', 'Year']]} value={period} onChange={setPeriod} />
        </Toolbar>

        <Panel title={`Year ${year}`}>
          <Ledger
            rows={[
              { label: 'Fees received', value: rupees(totalIn), note: `${months.filter((m) => m.income).length} months with income` },
              { label: 'Expenses', value: rupees(totalOut), note: 'All categories, including coach pay' },
              { label: 'Net for the year', value: rupees(totalIn - totalOut), note: totalIn - totalOut >= 0 ? 'Surplus' : 'Deficit' },
            ]}
          />
        </Panel>

        <Panel title="Month by month">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Fees in</th>
                  <th className="num">Expenses</th>
                  <th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <td data-label="Month">
                      <a href="#finance" onClick={() => { setUi({ ...ui, month: m.key }); setPeriod('month'); }}>{m.name}</a>
                    </td>
                    <td className="num" data-label="Fees in">{rupees(m.income)}</td>
                    <td className="num" data-label="Expenses">{rupees(m.spent)}</td>
                    <td className="num" data-label="Net">{rupees(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Coach pay for the year">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Coach</th>
                  <th className="num">Monthly pay</th>
                  <th className="num">Paid this year</th>
                </tr>
              </thead>
              <tbody>
                {coachYear.map(({ c, paid }) => (
                  <tr key={c.id}>
                    <td data-label="Coach">{c.name}</td>
                    <td className="num" data-label="Monthly pay">{rupees(c.monthly_pay)}</td>
                    <td className="num" data-label="Paid this year">{rupees(paid)}</td>
                  </tr>
                ))}
                {!coachYear.length && <Empty colSpan={3}>No active coaches. Add them in Setup.</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  }

  const received = receivedIn(data, month);
  const income = sumBy(received, (p) => p.amount);
  const expenses = expensesIn(data, month).sort((a, b) => b.day.localeCompare(a.day));
  const spent = sumBy(expenses, (e) => e.amount);
  const byCategory = {};
  expenses.forEach((e) => (byCategory[e.category] = (byCategory[e.category] || 0) + e.amount));

  return (
    <>
      <PageHeader title="Finance" summary={`Money in and out for ${monthLabel(month)}`}>
        <Button variant="secondary" size="small" onClick={() => shift(-1)} aria-label="Previous month">‹ Previous</Button>
        <Button variant="secondary" size="small" onClick={() => shift(1)} aria-label="Next month">Next ›</Button>
        <Button variant="primary" onClick={() => openForm('expenses')}>Add expense</Button>
      </PageHeader>
      <Toolbar>
        <Segmented label="Period" options={[['month', 'Month'], ['year', 'Year']]} value={period} onChange={setPeriod} />
      </Toolbar>

      <Panel title="Totals">
        <Ledger
          rows={[
            { label: 'Fees received', value: rupees(income), note: `${received.length} payments` },
            { label: 'Expenses', value: rupees(spent), note: `${expenses.length} entries` },
            { label: 'Net', value: rupees(income - spent), note: income - spent >= 0 ? 'Surplus' : 'Deficit' },
          ]}
        />
      </Panel>

      <Panel title="Coach pay">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Coach</th>
                <th className="num">Monthly pay</th>
                <th className="num">Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeCoaches.map((c) => {
                const paid = coachPaidIn(data, c.id, month);
                const st = coachStatus(paid, c.monthly_pay);
                return (
                  <tr key={c.id}>
                    <td data-label="Coach">{c.name}</td>
                    <td className="num" data-label="Monthly pay">{rupees(c.monthly_pay)}</td>
                    <td className="num" data-label="Paid">{rupees(paid)}</td>
                    <td data-label="Status"><Status tone={st.tone}>{st.text}</Status></td>
                  </tr>
                );
              })}
              {!activeCoaches.length && <Empty colSpan={4}>No active coaches. Add them in Setup.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Where the money went">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([c, v]) => (
                  <tr key={c}>
                    <td data-label="Category">{c}</td>
                    <td className="num" data-label="Amount">{rupees(v)}</td>
                  </tr>
                ))}
              {!Object.keys(byCategory).length && <Empty colSpan={2}>No expenses this month.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Expenses">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th className="num">Amount</th>
                <th className="actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td data-label="Date">{dayLabel(e.day)}</td>
                  <td data-label="Category">
                    {e.category}
                    {e.coach_id ? <span className="muted"> · {data.coaches.find((c) => c.id === e.coach_id)?.name || ''}</span> : null}
                  </td>
                  <td data-label="Note">{e.note || <span className="muted">—</span>}</td>
                  <td className="num" data-label="Amount">{rupees(e.amount)}</td>
                  <td className="actions">
                    <Button variant="text" size="small" onClick={() => remove('expenses', e.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {!expenses.length && <Empty colSpan={5}>No expenses this month. Use Add expense to record one.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
