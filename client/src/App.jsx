import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api.js';
import { connectLive } from './lib/live.js';
import { thisMonth, today } from './lib/format.js';
import { Sidebar } from './components/Sidebar.jsx';
import { FormDialog } from './components/FormDialog.jsx';
import { Loader } from './components/Loader.jsx';
import { Toast, useToast } from './components/ui.jsx';
import { Home } from './views/Home.jsx';
import { Students } from './views/Students.jsx';
import { Attendance } from './views/Attendance.jsx';
import { Fees } from './views/Fees.jsx';
import { Finance } from './views/Finance.jsx';
import { Messages } from './views/Messages.jsx';
import { Setup } from './views/Setup.jsx';

const VIEWS = { home: Home, students: Students, attendance: Attendance, fees: Fees, finance: Finance, whatsapp: Messages, setup: Setup };

const currentView = () => {
  const v = window.location.hash.slice(1);
  return v in VIEWS ? v : 'home';
};

export default function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState(currentView);
  const [ui, setUi] = useState({ month: thisMonth(), day: today(), search: '', batch: '', personType: 'student' });
  const [form, setForm] = useState(null);
  const [info, setInfo] = useState({ demo: false });
  const [live, setLive] = useState({ connected: false, punches: [], tick: 0 });
  const { message, show } = useToast();

  const refresh = useCallback(async () => {
    try {
      setData(await api('GET', 'data'));
    } catch (e) {
      show(e.message);
    }
  }, [show]);

  useEffect(() => {
    refresh();
    api('GET', 'info').then(setInfo).catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const onHash = () => setView(currentView());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Today's punches so far, so a reload doesn't empty the feed.
  useEffect(() => {
    api('GET', `punches?day=${today()}`)
      .then((rows) => setLive((l) => ({ ...l, punches: rows.map((r) => ({ type: 'punch', ...r })) })))
      .catch(() => {});
  }, []);

  // One live connection for the whole app. Punches and messages bump `tick`, which tells open screens to re-read their data.
  useEffect(
    () =>
      connectLive(
        (event) =>
          setLive((l) => ({
            ...l,
            connected: true,
            punches: event.type === 'punch' ? [event, ...l.punches].slice(0, 50) : l.punches,
            tick: l.tick + 1,
          })),
        (connected) => setLive((l) => ({ ...l, connected })),
      ),
    [],
  );

  const openForm = (table, record = null, extra = {}) => setForm({ table, record, extra, month: ui.month });

  const remove = async (table, id) => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    try {
      await api('DELETE', `${table}/${id}`);
      show('Deleted');
      refresh();
    } catch (e) {
      show(e.message);
    }
  };

  if (!data) return <Loader />;
  const View = VIEWS[view];

  return (
    <div className="app">
      <Sidebar view={view} live={live.connected} demo={info.demo} />
      <main className="main">
        <View data={data} ui={ui} setUi={setUi} openForm={openForm} remove={remove} show={show} live={live} demo={info.demo} />
      </main>
      <FormDialog
        form={form}
        data={data}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          show('Saved');
          refresh();
        }}
      />
      <Toast message={message} />
    </div>
  );
}
