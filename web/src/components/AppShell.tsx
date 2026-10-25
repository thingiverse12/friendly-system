import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { initials } from '../format';
import { Icon, type IconName } from './Icon';
import { Logo } from './Illustrations';
import { Mascot } from './Mascot';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: 'Hem', icon: 'home', end: true },
  { to: '/mal', label: 'Mål', icon: 'target' },
  { to: '/transaktioner', label: 'Transaktioner', icon: 'receipt' },
  { to: '/tavlingar', label: 'Tävlingar', icon: 'trophy' },
  { to: '/bedrifter', label: 'Bedrifter', icon: 'medal' },
  { to: '/profil', label: 'Profil', icon: 'user' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, stats, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
      push('Du är utloggad. Välkommen tillbaka!', 'info');
      navigate('/logga-in', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const level = stats?.level;

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Hoppa till innehåll
      </a>

      <header className="mobile-bar">
        <NavLink to="/" className="mobile-bar__brand" aria-label="Sparly – hem">
          <Logo />
        </NavLink>
        <NavLink to="/profil" className="avatar avatar--sm" aria-label="Profil och integritet">
          {user ? initials(user.profile.alias) : 'S'}
        </NavLink>
      </header>

      <aside className="sidebar">
        <div className="sidebar__brand">
          <Logo light />
          <p className="sidebar__tagline">Små steg. Stora mål.</p>
        </div>

        <nav className="sidebar__nav" aria-label="Huvudnavigering">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__mascot">
          <Mascot variant="animated" size={92} className="sidebar__mascot-art" />
          <p className="sidebar__mascot-line">Jag håller koll på dina steg.</p>
        </div>

        {level ? (
          <div className="sidebar__level">
            <div className="sidebar__level-head">
              <span className="sidebar__level-label">Nivå {level.level}</span>
              <span className="sidebar__level-name">{level.name}</span>
            </div>
            <div className="sidebar__level-track">
              <span style={{ width: `${level.progressToNextBps / 100}%` }} />
            </div>
            <p className="sidebar__level-hint">
              {level.nextLevelAt
                ? `${level.earnedCount} av ${level.nextLevelAt} bedrifter till nästa nivå`
                : 'Högsta nivån uppnådd'}
            </p>
          </div>
        ) : null}

        <div className="sidebar__account">
          <NavLink to="/profil" className="sidebar__account-main">
            <span className="avatar avatar--sm">{user ? initials(user.profile.alias) : 'S'}</span>
            <span className="sidebar__account-text">
              <strong>{user?.profile.alias ?? 'Sparly'}</strong>
              <small>{user?.email}</small>
            </span>
          </NavLink>
          <button type="button" className="icon-button icon-button--dark" onClick={onLogout} disabled={busy} aria-label="Logga ut">
            <Icon name="logout" size={19} />
          </button>
        </div>
      </aside>

      <main className="app-main" id="main">
        <div className="page">{children}</div>
      </main>

      <nav className="tabbar" aria-label="Huvudnavigering">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}
            title={item.label}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
