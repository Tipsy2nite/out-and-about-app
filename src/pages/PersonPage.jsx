import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import EventCard from '../components/EventCard.jsx';
import ReportButton from '../components/ReportButton.jsx';

export default function PersonPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(undefined);
  const [events, setEvents] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [age, setAge] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      setP(data ?? null);
      const { data: a } = await supabase.rpc('profile_age', { pid: id });
      setAge(typeof a === 'number' ? a : null);
      const { data: ev } = await supabase.from('events').select('*').eq('host_id', id)
        .gte('starts_at', new Date().toISOString()).order('starts_at');
      setEvents(ev || []);
      const { data: b } = await supabase.from('blocks').select('blocked_id').eq('blocked_id', id).maybeSingle();
      setBlocked(Boolean(b));
    })();
  }, [id, user]);

  if (!user) return <p className="pad"><Link to="/signin">Sign in</Link> to see profiles.</p>;
  if (p === undefined) return <p className="pad muted">Loading…</p>;
  if (p === null) return <p className="pad">This profile isn't available.</p>;

  const toggleBlock = async () => {
    if (blocked) await supabase.from('blocks').delete().eq('blocked_id', id);
    else await supabase.from('blocks').insert({ blocked_id: id });
    setBlocked(!blocked);
  };

  return (
    <div className="pad narrow">
      <div className="row"><span className="avatar avatar-xl">{p.display_name.charAt(0)}</span>
        <div><h1 className="page-title">{p.display_name}</h1>
          <p className="small">{p.verified ? 'Verified' : 'Not verified yet'}{age !== null ? ` · ${age}` : ''}{p.neighborhood ? ` · ${p.neighborhood}` : ''}</p></div></div>
      {p.bio && <p className="prose">{p.bio}</p>}
      {p.vibes.length > 0 && <div className="chips">{p.vibes.map((v) => <span key={v} className="pill">{v}</span>)}</div>}
      <h2>Hosting soon</h2>
      <div className="stack">{events.map((e) => <EventCard key={e.id} event={e} />)}</div>
      {events.length === 0 && <p className="muted">Nothing coming up.</p>}
      {user.id !== id && (
        <div className="row">
          <button type="button" className="linkish" onClick={toggleBlock}>{blocked ? 'Unblock' : 'Block'}</button>
          <ReportButton targetType="user" targetId={id} label="Report this person" />
        </div>
      )}
    </div>
  );
}
