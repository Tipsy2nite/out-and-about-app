import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useEvents from './useEvents.js';
import EventCard from '../components/EventCard.jsx';
import MapView from '../components/MapView.jsx';
import Chip from '../components/Chip.jsx';
import { CATEGORIES } from '../lib/constants.js';
import { useAuth } from '../lib/auth.jsx';

export default function Explore() {
  const { user } = useAuth();
  const { events, goingIds, error } = useEvents();
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [stepFree, setStepFree] = useState(false);
  const [quiet, setQuiet] = useState(false);

  const shown = useMemo(() => (events || []).filter((e) => {
    const q = query.trim().toLowerCase();
    return (cat === 'All' || e.category === cat)
      && (!verifiedOnly || e.host?.verified)
      && (!stepFree || e.access_entry === 'Step-free')
      && (!quiet || e.access_noise === 'Quiet')
      && (!q || `${e.title} ${e.area_label} ${e.category} ${e.tags.join(' ')}`.toLowerCase().includes(q));
  }), [events, cat, query, verifiedOnly, stepFree, quiet]);

  return (
    <div className="explore">
      <div className="explore-list">
        {!user && (
          <section className="hero">
            <h1>Log off. Go outside. Bring friends.</h1>
            <p>Park picnics, porch concerts, open-invite birthdays, and the delightfully specific meetups you didn't know existed.</p>
            <Link to="/signin" className="btn btn-primary">Join Out &amp; About</Link>
          </section>
        )}
        <h2 className="page-title">What's happening outside</h2>
        <div className="parent-tiles">
          <Link to="/parents/moms" className="tile tile-moms"><strong>For moms</strong><span>Mom friends and meetups</span></Link>
          <Link to="/parents/dads" className="tile tile-dads"><strong>For dads</strong><span>Start a dad hang</span></Link>
        </div>
        <label className="search">
          <span className="sr">Search gatherings</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Picnics, jazz, chess, birthdays…" />
        </label>
        <div className="chips scroll-x">
          {['All', ...CATEGORIES].map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
          {user && <Chip on={verifiedOnly} onClick={() => setVerifiedOnly(!verifiedOnly)}>Verified hosts</Chip>}
          <Chip on={stepFree} onClick={() => setStepFree(!stepFree)}>Step-free</Chip>
          <Chip on={quiet} onClick={() => setQuiet(!quiet)}>Quiet</Chip>
        </div>
        {error && <p className="error">Couldn't load gatherings: {error}</p>}
        {events === null && <p className="muted">Loading gatherings…</p>}
        <div className="ticket-grid">
          {shown.map((e) => <EventCard key={e.id} event={e} going={goingIds.has(e.id)} />)}
        </div>
        {events && shown.length === 0 && (
          <div className="empty">
            <h3>Nothing here yet, so start it?</h3>
            <p>If you're looking for it, someone else is too.</p>
            <Link to="/host" className="btn btn-primary">Host a gathering</Link>
          </div>
        )}
      </div>
      <aside className="explore-map" aria-label="Map of gatherings">
        <MapView events={shown} height="calc(100vh - 140px)" />
        <p className="small muted legend">Dashed circles are general areas. Exact spots unlock when you RSVP.</p>
      </aside>
    </div>
  );
}
