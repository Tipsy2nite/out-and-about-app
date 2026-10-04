import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useEvents from './useEvents.js';
import EventCard from '../components/EventCard.jsx';
import MapView from '../components/MapView.jsx';
import Chip from '../components/Chip.jsx';
import { AUDIENCES, CATEGORIES } from '../lib/constants.js';
import { useAuth } from '../lib/auth.jsx';

export default function Explore() {
  const { user } = useAuth();
  const { events, goingIds, error } = useEvents();
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [stepFree, setStepFree] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [aud, setAud] = useState(null); // key from AUDIENCES, or null for everything

  const shown = useMemo(() => (events || []).filter((e) => {
    const q = query.trim().toLowerCase();
    const lens = AUDIENCES.find((a) => a.key === aud);
    return (cat === 'All' || e.category === cat)
      && (!lens || lens.match(e))
      && (!verifiedOnly || e.host?.verified)
      && (!stepFree || e.access_entry === 'Step-free')
      && (!quiet || e.access_noise === 'Quiet')
      && (!q || `${e.title} ${e.area_label} ${e.category} ${e.tags.join(' ')}`.toLowerCase().includes(q));
  }), [events, cat, query, verifiedOnly, stepFree, quiet, aud]);

  return (
    <div className="explore">
      <div className="explore-list">
        {!user && (
          <section className="hero">
            <h1>Log off. Go outside. Bring friends.</h1>
            <p>Austin's place to plan and find things to do outside, for everyone. Park picnics, porch concerts, open-invite birthdays, and the delightfully specific meetups you didn't know existed.</p>
            <Link to="/signin" state={{ mode: 'signup' }} className="btn btn-primary">Join Out &amp; About</Link>
          </section>
        )}
        <h2 className="page-title">What's happening outside</h2>
        <p className="small strong for-label">Who's it for?</p>
        <div className="for-tiles" role="group" aria-label="Who's it for?">
          {AUDIENCES.map((a) => (
            <button key={a.key} type="button" className={`tile tile-btn${aud === a.key ? ' tile-on' : ''}`} style={{ background: a.tint }}
              aria-pressed={aud === a.key} onClick={() => setAud(aud === a.key ? null : a.key)}>
              <strong>{a.title}</strong><span>{a.blurb}</span>
            </button>
          ))}
          <Link to="/parents/moms" className="tile tile-moms"><strong>For moms</strong><span>Mom friends and meetups</span></Link>
          <Link to="/parents/dads" className="tile tile-dads"><strong>For dads</strong><span>Start a dad hang</span></Link>
        </div>
        {aud && (
          <p className="small for-showing">Showing: <strong>{AUDIENCES.find((a) => a.key === aud).title}</strong>. <button type="button" className="linkish" onClick={() => setAud(null)}>Show everything</button></p>
        )}
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
