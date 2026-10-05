import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { LOOKING_FOR, areaLabel } from '../lib/constants.js';
import Avatar from '../components/Avatar.jsx';
import Chip from '../components/Chip.jsx';
import FriendButton from '../components/FriendButton.jsx';

// Turn yourself on/off in Discover without leaving the page
function VisibilityCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [looking, setLooking] = useState(profile.looking_for?.length ? profile.looking_for : ['New friends']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const area = areaLabel(profile);

  const save = async (on) => {
    setBusy(true); setError('');
    const { error: err } = await supabase.from('profiles').update({ discoverable: on, looking_for: on ? looking : profile.looking_for }).eq('id', user.id);
    setBusy(false);
    if (err) setError(err.message); else refreshProfile();
  };
  const toggle = (v) => setLooking(looking.includes(v) ? looking.filter((x) => x !== v) : [...looking, v]);

  if (profile.discoverable) {
    return (
      <div className="panel panel-safe discover-me">
        <p style={{ margin: 0 }}><strong>You're visible in Discover</strong>{area ? <> as <strong>{area}</strong></> : ''}, looking for {(profile.looking_for || []).join(', ').toLowerCase() || 'friends'}.</p>
        <span className="row" style={{ gap: 14 }}>
          <Link to="/me#discover" className="small strong">Change what people see</Link>
          <button type="button" className="linkish small" disabled={busy} onClick={() => save(false)}>Hide me</button>
        </span>
        {error && <p className="error small">{error}</p>}
      </div>
    );
  }
  return (
    <div className="panel discover-me">
      <h3 style={{ margin: 0 }}>Want to show up here too?</h3>
      <p className="small" style={{ margin: 0 }}>You're hidden right now. If you turn this on, people nearby can see your name, photo, vibes, and {area ? <strong>{area}</strong> : 'your area'}. Never your exact location. You can change how much location shows in <Link to="/me#discover">settings</Link>.</p>
      <span className="small strong">I'm looking for</span>
      <div className="chips">{LOOKING_FOR.map((v) => <Chip key={v} on={looking.includes(v)} onClick={() => toggle(v)}>{v}</Chip>)}</div>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || looking.length === 0} onClick={() => save(true)}>{busy ? 'Saving…' : 'Show me in Discover'}</button>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

export default function DiscoverPage() {
  const { user, profile } = useAuth();
  const [scope, setScope] = useState(null);
  const [looking, setLooking] = useState('');
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');

  // Default to the closest area the viewer has filled in
  useEffect(() => {
    if (profile && scope === null) setScope(profile.neighborhood ? 'neighborhood' : profile.city ? 'city' : 'anywhere');
  }, [profile, scope]);

  useEffect(() => {
    if (!user || !profile || !scope) return;
    let live = true;
    setPeople(null);
    supabase.rpc('discover_people', { p_scope: scope, p_looking: looking || null, p_limit: 60 }).then(({ data, error: err }) => {
      if (!live) return;
      setError(err ? err.message : '');
      setPeople(data || []);
    });
    return () => { live = false; };
  }, [user, profile, scope, looking]);

  if (!user) return <div className="pad narrow"><h1 className="page-title">Discover</h1><p><Link to="/signin">Sign in</Link> to meet people near you who are looking for friends.</p></div>;
  if (!profile) return <div className="pad narrow"><h1 className="page-title">Discover</h1><p><Link to="/welcome">Finish setting up your profile</Link> first.</p></div>;

  const scopes = [
    profile.neighborhood && ['neighborhood', profile.neighborhood],
    profile.city && ['city', profile.city],
    profile.state && ['state', profile.state],
    ['anywhere', 'Anywhere'],
  ].filter(Boolean);

  return (
    <div className="pad discover">
      <header className="discover-head">
        <h1 className="page-title">Discover</h1>
        <p className="muted" style={{ margin: 0 }}>People nearby who are looking for friends or a group to join. Only people who choose to be visible show up here.</p>
      </header>

      <VisibilityCard />

      <div className="discover-filters">
        <div><span className="small strong">Near</span>
          <div className="chips scroll-x">{scopes.map(([k, label]) => <Chip key={k} on={scope === k} onClick={() => setScope(k)}>{label}</Chip>)}</div></div>
        <div><span className="small strong">Looking for</span>
          <div className="chips scroll-x">
            <Chip on={!looking} onClick={() => setLooking('')}>Anything</Chip>
            {LOOKING_FOR.map((v) => <Chip key={v} on={looking === v} onClick={() => setLooking(v)}>{v}</Chip>)}
          </div></div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {people === null && <p className="muted">Looking around…</p>}
      {people && people.length === 0 && (
        <div className="empty"><h3>No one here yet</h3>
          <p className="small">{scope !== 'anywhere' ? 'Try a wider area, or ' : ''}check back soon. You can also meet people at a <Link to="/">gathering</Link> or in a <Link to="/circles">circle</Link>.</p></div>
      )}

      <div className="person-grid">
        {(people || []).map((p) => (
          <article key={p.id} className="person discover-card">
            <Link to={`/people/${p.id}`} className="row"><Avatar name={p.display_name} url={p.avatar_url} />
              <span><strong>{p.display_name}</strong>{p.verified ? <span className="small"> ✓</span> : null}
                {p.area ? <><br /><span className="small muted">📍 {p.area}</span></> : null}</span></Link>
            {p.looking_for?.length > 0 && <div className="chips">{p.looking_for.map((v) => <span key={v} className="pill pill-like">{v}</span>)}</div>}
            {p.bio && <p className="small" style={{ margin: 0 }}>{p.bio}</p>}
            {p.vibes?.length > 0 && <p className="small muted" style={{ margin: 0 }}>Into: {p.vibes.slice(0, 3).join(', ')}</p>}
            <FriendButton personId={p.id} name={p.display_name} status={p.friend_status} />
          </article>
        ))}
      </div>
      <p className="safe-note small">Exact locations are never shown. Each person picks whether others see their neighborhood, city, or only their state. First meetups go best at a public gathering.</p>
    </div>
  );
}
