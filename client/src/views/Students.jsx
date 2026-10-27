import { activeStudents, batchOf, dueFor } from '../lib/data.js';
import { generalMessage, rupees, thisMonth } from '../lib/format.js';
import { Button, PageHeader, Panel, Segmented, Status, Toolbar, Empty } from '../components/ui.jsx';
import { Contact } from '../components/Contact.jsx';

export function Students({ data, ui, setUi, openForm }) {
  const q = ui.search.trim().toLowerCase();
  const month = thisMonth();
  const rows = data.students.filter(
    (s) =>
      (!ui.batch || String(s.batch_id) === ui.batch) &&
      (!q || `${s.name} ${s.guardian_name || ''}`.toLowerCase().includes(q)),
  );
  const batchOptions = [['', 'All'], ...data.batches.map((b) => [String(b.id), b.name])];

  return (
    <>
      <PageHeader
        title="Students"
        summary={`${activeStudents(data).length} active · ${data.students.length} in total`}
      >
        <Button variant="primary" onClick={() => openForm('students')}>Add student</Button>
      </PageHeader>

      <Toolbar>
        <input
          type="search"
          className="search"
          placeholder="Search student or parent"
          aria-label="Search students"
          value={ui.search}
          onChange={(e) => setUi({ ...ui, search: e.target.value })}
        />
        <Segmented label="Batch" options={batchOptions} value={ui.batch} onChange={(batch) => setUi({ ...ui, batch })} />
      </Toolbar>

      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th>Parent</th>
                <th>Fees this month</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const due = dueFor(data, s, month);
                return (
                  <tr key={s.id}>
                    <td data-label="Student">{s.name}</td>
                    <td data-label="Batch">{batchOf(data, s.batch_id)?.name || 'No batch'}</td>
                    <td data-label="Parent">{s.guardian_name || <span className="muted">—</span>}</td>
                    <td data-label="Fees">
                      {s.status !== 'active' ? (
                        <Status>Inactive</Status>
                      ) : due.balance ? (
                        <Status tone="due">{rupees(due.balance)} due</Status>
                      ) : (
                        <Status tone="ok">Paid</Status>
                      )}
                    </td>
                    <td className="actions">
                      <Contact phone={s.guardian_phone} message={generalMessage(s)} />
                      <Button variant="text" size="small" onClick={() => openForm('students', s)}>Edit</Button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <Empty colSpan={5}>No students match. Clear the search, or add a student.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
