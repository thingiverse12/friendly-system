import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth-context.jsx';
import { Avatar } from './ui.jsx';

const NAV = [
  { to: '/hem', label: 'Hem', icon: 'home' },
  { to: '/ny-utredning', label: 'Starta utredning', icon: 'search' },
  { to: '/fortsatt', label: 'Fortsätt utredning', icon: 'clock' },
  { to: '/multiplayer', label: 'Multiplayer', icon: 'users' },
  { to: '/katalog', label: 'Fallkatalog', icon: 'grid' },
  { to: '/byggare', label: 'Skapa eget fall', icon: 'pen' },
  { to: '/kampanj', label: 'Kampanj', icon: 'book' },
  { to: '/statistik', label: 'Statistik', icon: 'chart' },
  { to: '/installningar', label: 'Profil & inställningar', icon: 'gear' },
];

export function navItems(user) {
  const items = [...NAV];
  if (user && (user.role === 'moderator' || user.role === 'admin')) {
    items.splice(items.length - 1, 0, { to: '/moderation', label: 'Moderering', icon: 'shield' });
  }
  return items;
}

const BOTTOM = [
  { to: '/hem', label: 'Hem', icon: 'home' },
  { to: '/katalog', label: 'Katalog', icon: 'grid' },
  { to: '/ny-utredning', label: 'Utredning', icon: 'search' },
  { to: '/multiplayer', label: 'Multiplayer', icon: 'users' },
  { to: '/installningar', label: 'Profil', icon: 'gear' },
];

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6" /><path d="M17.5 14.6a5.5 5.5 0 0 1 3.5 5.4" /></>,
    grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>,
    pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></>,
    chart: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-8" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" /><path d="m9.5 12 2 2 3.5-4" /></>,
    gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.4 1Z" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
export { Icon };

function Wordmark({ small }) {
  return (
    <div className="wordmark" aria-label="Mordgåtan">
      <span className="wordmark-fingerprint" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" opacity=".25" />
          <circle cx="12" cy="12" r="6" opacity=".55" />
          <circle cx="12" cy="12" r="2.4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" opacity=".7" />
        </svg>
      </span>
      <span className="wordmark-text">
        M<span className="wordmark-o">O</span>RDGÅTAN
        {!small && <small>SANNINGEN LIGGER I DETALJERNA</small>}
      </span>
    </div>
  );
}

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Hoppa till innehållet</a>
      <aside className={`sidebar ${drawer ? 'sidebar-open' : ''}`} aria-label="Huvudnavigation">
        <div className="sidebar-brand"><Wordmark /></div>
        <nav>
          {navItems(user).map((item) => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setDrawer(false)}>
              <Icon name={item.icon} /> <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user card">
          <div className="row">
            <Avatar name={user?.displayName} initials={user?.displayName?.split(' ').map((w) => w[0]).slice(0, 2).join('')} color="#c8102e" size="sm" />
            <div style={{ minWidth: 0 }}>
              <div className="small" style={{ fontWeight: 700 }}>{user?.displayName}</div>
              <div className="faint small">@{user?.username}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }}
            onClick={async () => { await logout(); navigate('/'); }}>Logga ut</button>
        </div>
      </aside>
      {drawer && <button className="sidebar-scrim" aria-label="Stäng meny" onClick={() => setDrawer(false)} />}

      <div className="main-col">
        <header className="topbar">
          <button className="btn btn-ghost btn-sm hamburger" aria-label="Öppna meny" onClick={() => setDrawer(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <Wordmark small />
          <div className="spacer" />
          <Avatar name={user?.displayName} initials={user?.displayName?.split(' ').map((w) => w[0]).slice(0, 2).join('')} color="#c8102e" size="sm" />
        </header>
        <main id="main" className="main-content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Snabbnavigation">
        {BOTTOM.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-item ${isActive ? 'active' : ''}`}>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
