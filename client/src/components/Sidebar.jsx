import { WhatsAppIcon } from './WhatsAppIcon.jsx';

const logo = '/logo.png';

export const NAV = [
  { key: 'home', label: 'Today' },
  { key: 'students', label: 'Students' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'fees', label: 'Fees' },
  { key: 'finance', label: 'Finance' },
  { key: 'whatsapp', label: 'WhatsApp', icon: true },
  { key: 'setup', label: 'Setup' },
];

export function Sidebar({ view, live, demo }) {
  return (
    <aside className="rail">
      <div className="brand">
        <img src={logo} alt="Pattabhi Sports Club logo" />
        <span>Pattabhi Sports Club</span>
      </div>
      {demo && <span className="demo-tag">Sample data</span>}
      <nav className="nav" aria-label="Main">
        {NAV.map((item) => (
          <a key={item.key} href={`#${item.key}`} className="nav-item" aria-current={view === item.key ? 'page' : undefined}>
            {item.icon && <WhatsAppIcon size={18} />}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="rail-foot" role="status">
        <span className={`live-dot ${live ? 'on' : ''}`} aria-hidden="true" />
        {live ? 'Live' : 'Reconnecting…'}
      </div>
    </aside>
  );
}
