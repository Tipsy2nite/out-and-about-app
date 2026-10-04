import { NavLink, Link, Outlet } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { useAuth } from '../lib/auth.jsx';

const NAV = [
  ['/', 'Explore'],
  ['/map', 'Map'],
  ['/parents/moms', 'Moms'],
  ['/parents/dads', 'Dads'],
  ['/circles', 'Circles'],
  ['/host', 'Host'],
];

function Sun() {
  return (
    <svg width="32" height="32" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="30" fill="var(--sun)" stroke="var(--ink)" strokeWidth="6" />
      <g stroke="var(--ink)" strokeWidth="8" strokeLinecap="round">
        <line x1="60" y1="6" x2="60" y2="18" /><line x1="60" y1="102" x2="60" y2="114" />
        <line x1="6" y1="60" x2="18" y2="60" /><line x1="102" y1="60" x2="114" y2="60" />
      </g>
    </svg>
  );
}

export default function Layout() {
  const { user, profile } = useAuth();
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <Link to="/" className="brand"><Sun /><span>Out &amp; About</span></Link>
        <nav className="topnav" aria-label="Main">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className="navlink">{label}</NavLink>
          ))}
        </nav>
        <div className="topbar-end">
          {user
            ? <NavLink to="/me" className="avatar-btn-link" aria-label="My stuff"><Avatar name={profile?.display_name || 'You'} url={profile?.avatar_url} className="avatar-btn" /></NavLink>
            : <Link to="/signin" className="btn btn-primary btn-sm">Sign in</Link>}
        </div>
      </header>
      <main id="main" className="main"><Outlet /></main>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end className="tab">Explore</NavLink>
        <NavLink to="/map" className="tab">Map</NavLink>
        <NavLink to="/circles" className="tab">Circles</NavLink>
        <NavLink to="/host" className="tab">Host</NavLink>
        <NavLink to={user ? '/me' : '/signin'} className="tab">Me</NavLink>
      </nav>
      <footer className="footer">
        <Link to="/guidelines">Community guidelines &amp; safety</Link>
        <span>If you're in danger, call 911.</span>
      </footer>
    </div>
  );
}
