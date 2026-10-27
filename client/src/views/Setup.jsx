import { activeStudents, coachOf } from '../lib/data.js';
import { rupees } from '../lib/format.js';
import { Button, Empty, PageHeader, Panel, Status } from '../components/ui.jsx';

export function Setup({ data, openForm }) {
  return (
    <>
      <PageHeader title="Setup" summary="Coaches and batches. Changes here apply across the dashboard." />

      <Panel title="Coaches" action={<Button variant="primary" size="small" onClick={() => openForm('coaches')}>Add coach</Button>}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th className="num">Monthly pay</th>
                <th>Status</th>
                <th className="actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.coaches.map((c) => (
                <tr key={c.id}>
                  <td data-label="Name">{c.name}</td>
                  <td data-label="Phone">{c.phone || <span className="muted">—</span>}</td>
                  <td className="num" data-label="Monthly pay">{rupees(c.monthly_pay)}</td>
                  <td data-label="Status">{c.status === 'active' ? <Status tone="ok">Active</Status> : <Status>Inactive</Status>}</td>
                  <td className="actions">
                    <Button variant="text" size="small" onClick={() => openForm('coaches', c)}>Edit</Button>
                  </td>
                </tr>
              ))}
              {!data.coaches.length && <Empty colSpan={5}>No coaches yet. Use Add coach.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Batches" action={<Button variant="primary" size="small" onClick={() => openForm('batches')}>Add batch</Button>}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Schedule</th>
                <th>Coach</th>
                <th className="num">Students</th>
                <th className="num">Monthly fee</th>
                <th className="actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.batches.map((b) => (
                <tr key={b.id}>
                  <td data-label="Batch">
                    {b.name}
                    {b.status !== 'active' ? <span className="muted"> · inactive</span> : null}
                  </td>
                  <td data-label="Schedule">{b.schedule || <span className="muted">Not set</span>}</td>
                  <td data-label="Coach">{coachOf(data, b.coach_id)?.name || <span className="muted">No coach</span>}</td>
                  <td className="num" data-label="Students">{activeStudents(data).filter((s) => s.batch_id === b.id).length}</td>
                  <td className="num" data-label="Monthly fee">{rupees(b.monthly_fee)}</td>
                  <td className="actions">
                    <Button variant="text" size="small" onClick={() => openForm('batches', b)}>Edit</Button>
                  </td>
                </tr>
              ))}
              {!data.batches.length && <Empty colSpan={6}>No batches yet. Use Add batch.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
