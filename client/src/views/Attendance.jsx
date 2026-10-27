import { useEffect, useState } from 'react';
import { attendanceForMonth } from '../lib/api.js';

const YEAR_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const sessionDays = (map) => [...new Set([...map.keys()].filter((k) => k.includes('|coach|')).map((k) => k.split('|')[0]))].sort();
const shortMonth = (m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
import { monthLabel, shiftMonth } from '../lib/format.js';
import { Button, Empty, PageHeader, Panel, Segmented, Status, Toolbar } from '../components/ui.jsx';

// Coaches are marked by month here. Students come from the biometric device, which is not connected yet.
export function Attendance({ data, ui, setUi, show, live }) {
  const [tab, setTab] = useState('coaches');
  const [att, setAtt] = useState(new Map());
  const [year, setYear] = useState(null);
  const month = ui.month;
  const shift = (delta) => setUi({ ...ui, month: shiftMonth(month, delta) });

  useEffect(() => {
    if (tab !== 'coaches') return;
    attendanceForMonth(month).then(setAtt).catch((e) => show(e.message));
  }, [tab, month, show, live.tick]);

  useEffect(() => {
    if (tab !== 'coaches') return;
    Promise.all(YEAR_MONTHS.map((m) => attendanceForMonth(m).then((map) => [m, map])))
      .then(setYear)
      .catch((e) => show(e.message));
  }, [tab, show, live.tick]);

  const coaches = data.coaches.filter((c) => c.status === 'active');
  // A session is any day that has a coach record this month.
  const sessions = [...new Set([...att.keys()].filter((k) => k.includes('|coach|')).map((k) => k.split('|')[0]))].sort();
  const isIn = (st) => st === 'present' || st === 'late';

  const tally = coaches
    .map((c) => ({ c, came: sessions.filter((d) => isIn(att.get(`${d}|coach|${c.id}`))).length }))
    .sort((a, b) => b.came - a.came);
  const most = tally.length ? tally[0].came : 0;
  const leaders = tally.filter((t) => t.came === most && most > 0).map((t) => t.c.name);
  const totalCame = tally.reduce((t, x) => t + x.came, 0);
  const totalPossible = sessions.length * coaches.length;

  // January to October: every month's sessions, summed per coach and per month.
  const yearTally = year
    ? coaches
        .map((c) => {
          let came = 0;
          let possible = 0;
          for (const [m, map] of year) {
            const days = sessionDays(map);
            possible += days.length;
            came += days.filter((d) => isIn(map.get(`${d}|coach|${c.id}`))).length;
          }
          return { c, came, possible };
        })
        .sort((a, b) => b.came - a.came)
    : [];
  const yearTop = yearTally.length ? yearTally[0].came : 0;
  const yearLeaders = yearTally.filter((t) => t.came === yearTop && yearTop > 0).map((t) => t.c.name);
  const yearCame = yearTally.reduce((t, x) => t + x.came, 0);
  const yearPossible = yearTally.reduce((t, x) => t + x.possible, 0);
  const byMonth = year
    ? year.map(([m, map]) => {
        const days = sessionDays(map);
        const came = days.reduce((t, d) => t + coaches.filter((c) => isIn(map.get(`${d}|coach|${c.id}`))).length, 0);
        const possible = days.length * coaches.length;
        return { m, sessions: days.length, came, possible };
      })
    : [];

  return (
    <>
      <PageHeader title="Attendance" summary={tab === 'coaches' ? `${monthLabel(month)} · ${sessions.length} sessions` : 'Students from the biometric device'}>
        <div className="month-nav">
          <Button variant="secondary" size="small" onClick={() => shift(-1)} aria-label="Previous month">‹ Previous</Button>
          <strong>{monthLabel(month)}</strong>
          <Button variant="secondary" size="small" onClick={() => shift(1)} aria-label="Next month">Next ›</Button>
        </div>
      </PageHeader>

      <Toolbar>
        <Segmented label="Who" options={[['coaches', 'Coaches'], ['students', 'Students']]} value={tab} onChange={setTab} />
      </Toolbar>

      {tab === 'students' ? (
        <Panel title="Student attendance">
          <div className="coming-soon">
            <Status tone="muted">Coming soon</Status>
            <p>
              Once the biometric device is connected, each student's daily attendance will fill in here automatically, and the live punch feed will show arrivals as they happen.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel>
          {sessions.length ? (
            <>
              <div className="table-wrap">
                <table className="matrix">
                  <thead>
                    <tr>
                      <th>Coach</th>
                      {sessions.map((d) => (
                        <th key={d} className="mx" title={d}>
                          {Number(d.slice(8))}
                        </th>
                      ))}
                      <th className="num">Came</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c) => {
                      const came = sessions.filter((d) => isIn(att.get(`${d}|coach|${c.id}`))).length;
                      return (
                        <tr key={c.id}>
                          <td data-label="Coach">{c.name}</td>
                          {sessions.map((d) => {
                            const st = att.get(`${d}|coach|${c.id}`);
                            return (
                              <td key={d} className={`mx ${st === 'absent' ? 'a' : st ? 'p' : ''}`} title={`${d}: ${st || 'not marked'}`}>
                                {st === 'absent' ? 'A' : st ? 'P' : '·'}
                              </td>
                            );
                          })}
                          <td className="num" data-label="Came">
                            {came} of {sessions.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="legend">P present · A absent · · not marked. Scroll sideways on a phone to see every session.</p>
            </>
          ) : (
            <Empty colSpan={1}>No coach attendance recorded for {monthLabel(month)}.</Empty>
          )}
        </Panel>
      )}

      {tab === 'coaches' && sessions.length > 0 && (
        <Panel title="Who attended most">
          <p className="chart-lead">
            {leaders.length ? <strong>{leaders.join(' and ')}</strong> : 'Nobody yet'}
            {leaders.length ? ` attended the most: ${most} of ${sessions.length} sessions.` : ''}
          </p>
          <ul className="bars">
            {tally.map(({ c, came }) => (
              <li key={c.id} className={came === most && most > 0 ? 'top' : ''}>
                <span className="bar-name">{c.name}</span>
                <span className="bar-track" role="img" aria-label={`${c.name} attended ${came} of ${sessions.length}`}>
                  <i style={{ width: `${(came / sessions.length) * 100}%` }} />
                </span>
                <span className="bar-val">{came} of {sessions.length}</span>
              </li>
            ))}
          </ul>
          <p className="legend">
            Total attended: {totalCame} of {totalPossible} coach sessions ({totalPossible ? Math.round((totalCame / totalPossible) * 100) : 0}%).
          </p>
        </Panel>
      )}

      {tab === 'coaches' && year && yearPossible > 0 && (
        <Panel title="January to October 2026">
          <p className="chart-lead">
            {yearLeaders.length ? <strong>{yearLeaders.join(' and ')}</strong> : 'Nobody yet'}
            {yearLeaders.length ? ` attended the most across the year: ${yearTop} sessions.` : ''}
          </p>
          <ul className="bars">
            {yearTally.map(({ c, came, possible }) => (
              <li key={c.id} className={came === yearTop && yearTop > 0 ? 'top' : ''}>
                <span className="bar-name">{c.name}</span>
                <span className="bar-track" role="img" aria-label={`${c.name} attended ${came} of ${possible}`}>
                  <i style={{ width: `${(came / possible) * 100}%` }} />
                </span>
                <span className="bar-val">{came} of {possible}</span>
              </li>
            ))}
          </ul>
          <p className="legend">
            Overall: {yearCame} of {yearPossible} coach sessions attended ({Math.round((yearCame / yearPossible) * 100)}%) across {YEAR_MONTHS.length} months.
          </p>

          <h3 className="sub-head">Month by month</h3>
          <ul className="bars">
            {byMonth.map((x) => (
              <li key={x.m}>
                <span className="bar-name">{shortMonth(x.m)} · {x.sessions} sessions</span>
                <span className="bar-track" role="img" aria-label={`${shortMonth(x.m)} ${x.came} of ${x.possible}`}>
                  <i style={{ width: `${x.possible ? (x.came / x.possible) * 100 : 0}%` }} />
                </span>
                <span className="bar-val">{x.possible ? Math.round((x.came / x.possible) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
          <p className="legend">Each bar is the share of coach sessions attended that month, across all five coaches.</p>
        </Panel>
      )}
    </>
  );
}
