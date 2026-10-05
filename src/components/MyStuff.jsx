import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import EventCard from './EventCard.jsx';

// The private part of your own profile: only you see these sections.
export default function MyStuff() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [circles, setCircles] = useState([]);
  const [waves, setWaves] = useState([]);
  const [toRate, setToRate] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    let live = true;
    (async () => {
      const now = new Date(Date.now() - 3 * 3600000).toISOString();
      const hourAgo = new Date(Date.now() - 3600000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: r }, { data: c }, { data: w }, { data: past }, { data: done }] = await Promise.all([
        supabase.from('rsvps').select('event:events(*)').eq('user_id', user.id),
        supabase.from('circle_members').select('circle:circles(id, name, rhythm)').eq('user_id', user.id),
        supabase.from('waves').select('created_at, from:profiles!waves_from_id_fkey(id, display_name)').eq('to_id', user.id).order('created_at', { ascending: false }),
        // Gatherings you went to in the last 30 days that you haven't rated yet
        supabase.from('rsvps').select('event:events!inner(id, title, starts_at, host_id, status, host:profiles!events_host_id_fkey(display_name))')
          .eq('user_id', user.id).lte('event.starts_at', hourAgo).gte('event.starts_at', monthAgo),
        supabase.from('host_reviews').select('event_id').eq('reviewer_id', user.id),
      ]);
      if (!live) return;
      setPlans((r || []).map((x) => x.event).filter((e) => e && e.starts_at >= now && e.host_id !== user.id)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setCircles((c || []).map((x) => x.circle).filter(Boolean));
      setWaves(w || []);
      const reviewed = new Set((done || []).map((d) => d.event_id));
      setToRate((past || []).map((x) => x.event)
        .filter((e) => e && e.host_id !== user.id && e.status !== 'cancelled' && !reviewed.has(e.id))
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at)));
    })();
    return () => { live = false; };
  }, [user]);

  if (plans === null) return null;
  const watch = plans.filter((e) => e.status !== 'scheduled');

  return (
    <section className="my-stuff" aria-label="Only you can see this">
      <p className="only-you small">Only you can see this part</p>

      {watch.length > 0 && (
        <div className="panel panel-watch"><strong>Plans changed:</strong> {watch.map((e) => `${e.title} (${e.status})`).join(', ')}. Open the gathering for details.</div>
      )}

      {toRate.length > 0 && (
        <div className="panel panel-review"><h3>How did it go?</h3>
          <p className="small">Rate your hosts so newcomers know who throws a great gathering.</p>
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {toRate.map((e) => (
              <li key={e.id}><Link to={`/events/${e.id}`}><strong>{e.title}</strong></Link>
                <span className="small muted"> · hosted by {e.host?.display_name || 'a host'}</span> · <Link to={`/events/${e.id}`} className="small strong">Rate ★</Link></li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2>My plans</h2>
        <div className="stack">{plans.map((e) => <EventCard key={e.id} event={e} going />)}</div>
        {plans.length === 0 && <p className="muted">Your calendar is wide open. <Link to="/">Find something</Link>.</p>}
      </div>

      <div>
        <h2>My circles</h2>
        <div className="stack">
          {circles.map((c) => <Link key={c.id} to={`/circles/${c.id}`} className="row-card"><span className="avatar">{c.name.charAt(0)}</span><span><strong>{c.name}</strong>{c.rhythm ? <><br /><span className="small">{c.rhythm}</span></> : null}</span></Link>)}
        </div>
        {circles.length === 0 && <p className="muted"><Link to="/circles">Find your people</Link></p>}
      </div>

      {waves.length > 0 && (
        <div>
          <h2>Waves</h2>
          {waves.map((w) => <p key={w.from?.id}><Link to={`/people/${w.from?.id}`}>{w.from?.display_name}</Link> said hi · {timeAgo(w.created_at)}</p>)}
        </div>
      )}
    </section>
  );
}
