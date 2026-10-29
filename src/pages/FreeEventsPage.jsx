import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useEvents from './useEvents.js';
import EventCard from '../components/EventCard.jsx';
import MapView from '../components/MapView.jsx';
import Chip from '../components/Chip.jsx';
import { CATEGORIES } from '../lib/constants.js';
import { useAuth } from '../lib/auth.jsx';

const monthLabel = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Free community events around Austin (tree lightings, markets, park shows),
// listed by the Out & About team. Member-hosted gatherings live on Explore.
export default function FreeEventsPage() {
  const { isAdmin } = useAuth();
  const { events, goingIds, error } = useEvents({ listing: 'free_event' });
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => (events || []).filter((e) => {
    const q = query.trim().toLowerCase();
    return (cat === 'All' || e.category === cat)
      && (!q || `${e.title} ${e.area_label} ${e.category} ${e.description || ''} ${e.tags.join(' ')}`.toLowerCase().includes(q));
  }), [events, cat, query]);

  // Group by month so it reads like a calendar
  const months = useMemo(() => {
    const out = [];
    shown.forEach((e) => {
      const m = monthLabel(e.starts_at);
      if (!out.length || out[out.length - 1].month !== m) out.push({ month: m, items: [] });
      out[out.length - 1].items.push(e);
    });
    return out;
  }, [shown]);

  return (
    <div className="explore">
      <div className="explore-list">
        <section className="hero hero-free">
          <p className="pill pill-sun">Free</p>
          <h1>Free in Austin</h1>
          <p>Free things happening around town: tree lightings, park shows, markets, and holiday strolls. RSVP to tell people you're going and get an email if plans change.</p>
          {isAdmin && <Link to="/host?listing=free_event" className="btn btn-primary btn-sm">Add a free event</Link>}
        </section>

        <label className="search">
          <span className="sr">Search free events</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tree lighting, market, puppet show…" />
        </label>
        <div className="chips scroll-x">
          {['All', ...CATEGORIES].map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>

        {error && <p className="error">Couldn't load events: {error}</p>}
        {events === null && <p className="muted">Loading free events…</p>}
        {months.map((m) => (
          <section key={m.month} className="free-month">
            <h2 className="month-title">{m.month}</h2>
            <div className="ticket-grid">
              {m.items.map((e) => <EventCard key={e.id} event={e} going={goingIds.has(e.id)} />)}
            </div>
          </section>
        ))}
        {events && shown.length === 0 && (
          <div className="empty">
            <h3>No free events listed right now</h3>
            <p>Check back soon, or see what members are hosting.</p>
            <Link to="/" className="btn btn-primary">Explore gatherings</Link>
          </div>
        )}
        <p className="small muted">Free events are listed by the Out &amp; About team from public sources. Details can change, so check each event's official page before you head out.</p>
      </div>
      <aside className="explore-map" aria-label="Map of free events">
        <MapView events={shown} height="calc(100vh - 140px)" />
      </aside>
    </div>
  );
}
