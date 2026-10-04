import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { COVER_COLORS, DISLIKE_SUGGESTIONS, LIKE_SUGGESTIONS, PROJECT_EMAIL, SPOT_SUGGESTIONS, STAGES, VIBES } from '../lib/constants.js';
import { timeAgo } from '../lib/format.js';
import { ChipGroup } from '../components/Chip.jsx';
import EventCard from '../components/EventCard.jsx';
import TagInput from '../components/TagInput.jsx';

export default function MePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [f, setF] = useState(null);
  const [trusted, setTrusted] = useState('');
  const [plans, setPlans] = useState([]);
  const [hosting, setHosting] = useState([]);
  const [circles, setCircles] = useState([]);
  const [waves, setWaves] = useState([]);
  const [saved, setSaved] = useState('');
  const [toRate, setToRate] = useState([]);

  useEffect(() => {
    setF({
      display_name: profile.display_name, neighborhood: profile.neighborhood || '', bio: profile.bio || '',
      vibes: profile.vibes, parent_role: profile.parent_role || '', kids_stages: profile.kids_stages,
      show_in_parent_finder: profile.show_in_parent_finder, hide_from_guest_lists: profile.hide_from_guest_lists,
      hide_age: Boolean(profile.hide_age),
      pronouns: profile.pronouns || '', hometown: profile.hometown || '', work: profile.work || '',
      austin_since: profile.austin_since ? String(profile.austin_since) : '',
      languages: profile.languages || [], likes: profile.likes || [], dislikes: profile.dislikes || [],
      favorite_spots: profile.favorite_spots || [], perfect_weekend: profile.perfect_weekend || '',
      ask_me_about: profile.ask_me_about || '', cover_color: profile.cover_color || '',
    });
  }, [profile]);

  useEffect(() => {
    (async () => {
      const now = new Date(Date.now() - 3 * 3600000).toISOString();
      const [{ data: r }, { data: h }, { data: c }, { data: w }, { data: p }] = await Promise.all([
        supabase.from('rsvps').select('event:events(*)').eq('user_id', user.id),
        supabase.from('events').select('*').eq('host_id', user.id).gte('starts_at', now).order('starts_at'),
        supabase.from('circle_members').select('circle:circles(id, name, rhythm)').eq('user_id', user.id),
        supabase.from('waves').select('created_at, from:profiles!waves_from_id_fkey(id, display_name)').eq('to_id', user.id).order('created_at', { ascending: false }),
        supabase.from('profile_private').select('trusted_contact_email').eq('user_id', user.id).maybeSingle(),
      ]);
      setPlans((r || []).map((x) => x.event).filter((e) => e && e.starts_at >= now && e.host_id !== user.id)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setHosting(h || []);
      setCircles((c || []).map((x) => x.circle).filter(Boolean));
      setWaves(w || []);
      setTrusted(p?.trusted_contact_email || '');

      // Gatherings you went to in the last 30 days that you haven't rated yet
      const hourAgo = new Date(Date.now() - 3600000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: past }, { data: done }] = await Promise.all([
        supabase.from('rsvps').select('event:events!inner(id, title, starts_at, host_id, status, host:profiles!events_host_id_fkey(display_name))')
          .eq('user_id', user.id).lte('event.starts_at', hourAgo).gte('event.starts_at', monthAgo),
        supabase.from('host_reviews').select('event_id').eq('reviewer_id', user.id),
      ]);
      const reviewed = new Set((done || []).map((d) => d.event_id));
      setToRate((past || []).map((x) => x.event)
        .filter((e) => e && e.host_id !== user.id && e.status !== 'cancelled' && !reviewed.has(e.id))
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at)));
    })();
  }, [user]);

  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaved('');
    const { error } = await supabase.from('profiles').update({
      ...f, parent_role: f.parent_role || null, neighborhood: f.neighborhood || null, bio: f.bio || null,
      pronouns: f.pronouns.trim() || null, hometown: f.hometown.trim() || null, work: f.work.trim() || null,
      austin_since: f.austin_since ? Number(f.austin_since) : null,
      perfect_weekend: f.perfect_weekend.trim() || null, ask_me_about: f.ask_me_about.trim() || null,
      cover_color: f.cover_color || null,
    }).eq('id', user.id);
    const { error: e2 } = await supabase.from('profile_private').update({ trusted_contact_email: trusted || null }).eq('user_id', user.id);
    setSaved(error || e2 ? `Didn't save: ${(error || e2).message}` : 'Saved.');
    refreshProfile();
  };

  const watch = plans.filter((e) => e.status !== 'scheduled');

  return (
    <div className="pad me-grid">
      <section className="stack">
        <div className="row"><span className="avatar avatar-xl">{profile.display_name.charAt(0)}</span>
          <div><h1 className="page-title">{profile.display_name}</h1>
            <p className="small">{profile.verified ? 'Verified' : 'Not verified yet'} · {plans.length} plans · {circles.length} circles</p></div></div>
        {!profile.verified && (
          <div className="panel"><h3>Get verified</h3>
            <p className="small">Verified people get a badge so others know our team has confirmed who they are. During the beta, our team verifies people by hand. Email <a href={`mailto:${PROJECT_EMAIL}?subject=Verify%20me`}>{PROJECT_EMAIL}</a> to start.</p></div>
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
        {watch.length > 0 && (
          <div className="panel panel-watch"><strong>Plans changed:</strong> {watch.map((e) => `${e.title} (${e.status})`).join(', ')}. Open the gathering for details.</div>
        )}
        <h2>My plans</h2>
        {plans.map((e) => <EventCard key={e.id} event={e} going />)}
        {plans.length === 0 && <p className="muted">Your calendar is wide open. <Link to="/">Find something</Link>.</p>}
        <h2>I'm hosting</h2>
        {hosting.map((e) => <EventCard key={e.id} event={e} />)}
        {hosting.length === 0 && <p className="muted"><Link to="/host">Host a gathering</Link></p>}
        <h2>My circles</h2>
        {circles.map((c) => <Link key={c.id} to={`/circles/${c.id}`} className="row-card"><span className="avatar">{c.name.charAt(0)}</span><span><strong>{c.name}</strong>{c.rhythm ? <><br /><span className="small">{c.rhythm}</span></> : null}</span></Link>)}
        {circles.length === 0 && <p className="muted"><Link to="/circles">Find your people</Link></p>}
        {waves.length > 0 && <>
          <h2>Waves</h2>
          {waves.map((w) => <p key={w.from?.id}><Link to={`/people/${w.from?.id}`}>{w.from?.display_name}</Link> said hi · {timeAgo(w.created_at)}</p>)}
        </>}
      </section>

      <form className="stack form" onSubmit={save}>
        <div className="row-between"><h2>Profile</h2><Link to={`/people/${user.id}`} className="small strong">View my profile</Link></div>
        <label className="field">Name<input required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></label>
        <label className="field">Neighborhood<input value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} /></label>
        <label className="field">About you<textarea rows={3} maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
        <fieldset><legend>My vibes</legend><ChipGroup multi options={VIBES} value={f.vibes} onChange={(v) => setF({ ...f, vibes: v })} /></fieldset>

        <h2 className="about-head">About me</h2>
        <p className="small muted" style={{ marginTop: -8 }}>All optional. Members who are signed in can see these on your profile.</p>
        <label className="field">Pronouns<input maxLength={30} value={f.pronouns} onChange={set('pronouns')} placeholder="she/her, he/him, they/them…" /></label>
        <label className="field">Where are you from?<input maxLength={60} value={f.hometown} onChange={set('hometown')} placeholder="San Antonio, TX" /></label>
        <label className="field">In Austin since (year)<input type="number" inputMode="numeric" min={1930} max={new Date().getFullYear()} value={f.austin_since} onChange={set('austin_since')} placeholder="2019" /></label>
        <label className="field">What do you do?<input maxLength={80} value={f.work} onChange={set('work')} placeholder="Teacher at…, nurse, student at UT, retired…" /></label>
        <TagInput label="Languages" value={f.languages} onChange={(v) => setF({ ...f, languages: v })} max={8} maxLength={24}
          suggestions={['English', 'Spanish', 'ASL', 'Vietnamese', 'Mandarin', 'Hindi', 'French']} placeholder="Add a language" />
        <TagInput label="Likes" hint="Things you're into. Press Enter after each one." value={f.likes} onChange={(v) => setF({ ...f, likes: v })} max={20}
          suggestions={LIKE_SUGGESTIONS} placeholder="Tacos, birding, 90s R&B…" />
        <TagInput label="Not my thing" hint="Helps hosts and new friends know what to skip." value={f.dislikes} onChange={(v) => setF({ ...f, dislikes: v })} max={20}
          suggestions={DISLIKE_SUGGESTIONS} placeholder="Cilantro, loud bars…" />
        <TagInput label="Favorite spots to visit" value={f.favorite_spots} onChange={(v) => setF({ ...f, favorite_spots: v })} max={15} maxLength={60}
          suggestions={SPOT_SUGGESTIONS} placeholder="Parks, patios, trails, shops…" />
        <label className="field">My perfect Austin weekend
          <textarea rows={2} maxLength={280} value={f.perfect_weekend} onChange={set('perfect_weekend')} placeholder="Breakfast tacos, a swim at Barton Springs, then live music on the east side." /></label>
        <label className="field">Ask me about
          <input maxLength={140} value={f.ask_me_about} onChange={set('ask_me_about')} placeholder="My sourdough starter, the best swimming holes…" /></label>
        <fieldset><legend>Profile cover color</legend>
          <div className="swatches" role="radiogroup" aria-label="Profile cover color">
            {COVER_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={f.cover_color === c} aria-label={`Cover color ${c}`}
                className="swatch" style={{ background: c }} onClick={() => setF({ ...f, cover_color: c })} />
            ))}
          </div>
        </fieldset>
        <fieldset><legend>Parent hubs</legend>
          <ChipGroup options={[['', 'Not a parent'], ['mom', 'Mom'], ['dad', 'Dad']]} value={f.parent_role} onChange={(v) => setF({ ...f, parent_role: v })} />
          {f.parent_role && <>
            <span className="small strong">Kids' age ranges</span>
            <ChipGroup multi options={STAGES} value={f.kids_stages} onChange={(v) => setF({ ...f, kids_stages: v })} />
            <label className="check"><input type="checkbox" checked={f.show_in_parent_finder} onChange={(e) => setF({ ...f, show_in_parent_finder: e.target.checked })} />
              Show me in "{f.parent_role === 'mom' ? 'Moms' : 'Dads'} near you"</label>
          </>}
        </fieldset>
        <h2>Safety &amp; privacy</h2>
        <label className="check"><input type="checkbox" checked={f.hide_from_guest_lists} onChange={(e) => setF({ ...f, hide_from_guest_lists: e.target.checked })} />
          Hide me from guest lists</label>
        <label className="check"><input type="checkbox" checked={f.hide_age} onChange={(e) => setF({ ...f, hide_age: e.target.checked })} />
          Hide my age on my profile</label>
        <label className="field">Trusted contact's email (for "Tell a friend where you'll be")
          <input type="email" value={trusted} onChange={(e) => setTrusted(e.target.value)} /></label>
        <button type="submit" className="btn btn-primary">Save changes</button>
        {saved && <p className="small" role="status">{saved}</p>}
        <p className="small"><Link to="/guidelines">Community guidelines &amp; safety center</Link></p>
        <p className="small">Want your account and data deleted? Email <a href={`mailto:${PROJECT_EMAIL}?subject=Delete%20my%20account`}>{PROJECT_EMAIL}</a>.</p>
        <button type="button" className="btn btn-outline" onClick={signOut}>Sign out</button>
      </form>
    </div>
  );
}
