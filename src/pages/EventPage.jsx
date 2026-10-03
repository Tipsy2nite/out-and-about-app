import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { TINTS } from '../lib/constants.js';
import { eventDateParts } from '../lib/format.js';
import WeatherBox from '../components/WeatherBox.jsx';
import ReportButton from '../components/ReportButton.jsx';

const STATUS_TEXT = { moved: 'Moved', postponed: 'Postponed', cancelled: 'Cancelled' };

export default function EventPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [ev, setEv] = useState(undefined);
  const [stats, setStats] = useState({ going: 0, first_timers: 0 });
  const [going, setGoing] = useState(false);
  const [address, setAddress] = useState(null);
  const [guests, setGuests] = useState([]);
  const [familiar, setFamiliar] = useState([]);
  const [trusted, setTrusted] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('events')
      .select('*, host:profiles(id, display_name, verified)').eq('id', id).maybeSingle();
    setEv(data ?? null);
    if (!data) return;
    const { data: s } = await supabase.rpc('event_stats', { eid: id });
    if (s?.[0]) setStats(s[0]);
    if (user) {
      const [{ data: r }, { data: loc }, { data: g }, { data: f }, { data: p }] = await Promise.all([
        supabase.from('rsvps').select('event_id').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
        supabase.from('event_locations').select('address').eq('event_id', id).maybeSingle(),
        supabase.rpc('event_guests', { eid: id }),
        supabase.rpc('familiar_faces', { eid: id }),
        supabase.from('profile_private').select('trusted_contact_email').eq('user_id', user.id).maybeSingle(),
      ]);
      setGoing(Boolean(r));
      setAddress(loc?.address ?? null);
      setGuests(g || []);
      setFamiliar(f || []);
      setTrusted(p?.trusted_contact_email || '');
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  if (ev === undefined) return <p className="pad muted">Loading…</p>;
  if (ev === null) return <div className="pad empty"><h2>This gathering isn't here anymore.</h2><Link to="/" className="btn btn-primary">Back to Explore</Link></div>;

  const d = eventDateParts(ev.starts_at);
  const isHost = user && ev.host_id === user.id;
  const cancelled = ev.status === 'cancelled';

  const toggleRsvp = async () => {
    if (!user) return nav('/signin', { state: { from: `/events/${id}` } });
    if (!profile) return nav('/welcome', { state: { from: `/events/${id}` } });
    setBusy(true); setMsg('');
    const { error } = going
      ? await supabase.from('rsvps').delete().eq('event_id', id).eq('user_id', user.id)
      : await supabase.from('rsvps').insert({ event_id: id });
    if (error) setMsg(`That didn't go through: ${error.message}`);
    await load();
    setBusy(false);
  };

  const setStatus = async (status) => {
    const note = status === 'scheduled' ? null : window.prompt('Add a short note for guests (where it moved, the new date, or why):') || null;
    await supabase.from('events').update({ status, status_note: note }).eq('id', id);
    load();
  };

  const remove = async () => {
    if (!window.confirm('Delete this gathering for everyone? This can\'t be undone.')) return;
    await supabase.from('events').delete().eq('id', id);
    nav('/');
  };

  const where = address || ev.area_label;
  const shareBody = encodeURIComponent(`I'm going to "${ev.title}" on ${d.long} at ${d.time}, at ${where}. Hosted by ${ev.host?.display_name || 'an Out & About host'}. Link: ${window.location.href}`);
  const shareHref = `mailto:${trusted}?subject=${encodeURIComponent('Where I\'ll be: ' + ev.title)}&body=${shareBody}`;

  return (
    <article className="event">
      <header className="event-head" style={{ background: TINTS[ev.category] }}>
        <Link to="/" className="back">Back</Link>
        <p className="kind">{ev.category} · {ev.size}{ev.audience !== 'everyone' ? ` · For ${ev.audience}` : ''}</p>
        <h1>{ev.title}</h1>
        {ev.status !== 'scheduled' && (
          <p className="status-banner"><strong>{STATUS_TEXT[ev.status]}.</strong> {ev.status_note}</p>
        )}
      </header>

      <div className="event-body">
        <div className="event-main">
          <p className="big">{d.long} · {d.time}</p>
          <div>
            {ev.is_private_location && !address
              ? <><p className="big">{ev.area_label}, general area</p><p className="muted">The exact address unlocks when you RSVP.</p></>
              : <><p className="big">{where}</p><p className="muted">{ev.is_private_location ? 'Private address. Please keep it to yourself.' : 'Public spot'}</p></>}
          </div>

          {ev.host && (
            <Link to={`/people/${ev.host.id}`} className="row-card">
              <span className="avatar">{ev.host.display_name.charAt(0)}</span>
              <span><span className="muted small">Hosted by</span><br /><strong>{ev.host.display_name}</strong><br />
                <span className="small">{ev.host.verified ? 'Verified host' : 'New host, not verified yet'}</span></span>
            </Link>
          )}

          {ev.description && <p className="prose">{ev.description}</p>}
          {ev.tags.length > 0 && <div className="chips">{ev.tags.map((t) => <span key={t} className="pill">{t}</span>)}</div>}

          {!isHost && (
            <button type="button" className={going ? 'btn btn-dark btn-wide' : 'btn btn-primary btn-wide'} onClick={toggleRsvp} disabled={busy || (cancelled && !going)}>
              {cancelled ? 'This gathering is cancelled' : going ? "You're in! (tap to cancel your RSVP)" : "I'm going"}
            </button>
          )}
          {msg && <p className="error">{msg}</p>}

          {isHost && (
            <section className="panel">
              <h3>You're hosting</h3>
              <p className="small">Changing plans updates this page and every guest's plans.</p>
              <div className="chips">
                <button type="button" className="chip" onClick={() => setStatus('moved')}>Moved to backup spot</button>
                <button type="button" className="chip" onClick={() => setStatus('postponed')}>Postpone</button>
                <button type="button" className="chip" onClick={() => setStatus('cancelled')}>Cancel</button>
                {ev.status !== 'scheduled' && <button type="button" className="chip" onClick={() => setStatus('scheduled')}>Back on as planned</button>}
              </div>
              <button type="button" className="linkish danger" onClick={remove}>Delete gathering</button>
            </section>
          )}
        </div>

        <div className="event-side">
          <WeatherBox event={ev} />

          <section className="panel">
            <h3>Who's going</h3>
            <p><strong>{stats.going} going</strong> · {stats.first_timers} first-timers. You won't be the only new face.</p>
            {familiar.length > 0 && (
              <p className="small"><strong>{familiar.map((f) => `${f.display_name} from ${f.circle_name}`).join(', ')}</strong></p>
            )}
            {(going || isHost) && guests.length > 0 && (
              <ul className="guest-list">
                {guests.map((g) => <li key={g.user_id}><Link to={`/people/${g.user_id}`}>{g.display_name}</Link>{g.verified ? ' · Verified' : ''}</li>)}
              </ul>
            )}
            {!going && !isHost && <p className="small muted">RSVP to see who else is coming.</p>}
            {profile?.hide_from_guest_lists && <p className="small muted">You're hidden from guest lists.</p>}
          </section>

          <section className="panel">
            <div className="row-between"><h3>Access &amp; comfort</h3>
              <span className={ev.access_entry === 'Step-free' ? 'pill pill-dark' : 'pill'}>{ev.access_entry}</span></div>
            <dl className="access">
              <div><dt>Shade</dt><dd>{ev.access_shade}</dd></div>
              <div><dt>Restrooms</dt><dd>{ev.access_restrooms}</dd></div>
              <div><dt>Noise</dt><dd>{ev.access_noise}</dd></div>
            </dl>
            {ev.access_notes && <p className="small">{ev.access_notes}</p>}
            <p className="small muted">Details come from the host. Report anything that's wrong so it gets fixed.</p>
          </section>

          <section className="panel panel-safe">
            <h3>Safety</h3>
            <p className="small">{ev.host?.verified ? 'Verified host: identity confirmed by our team.' : 'New host: not verified yet. Stick to public spots and bring a friend.'}</p>
            <p className="small">{ev.is_private_location ? 'Private home. The address is only shown to people who RSVP.' : 'Public place, open to everyone.'}</p>
            {user && <a className="btn btn-outline btn-sm" href={shareHref}>Tell a friend where you'll be</a>}
            <ReportButton targetType="event" targetId={ev.id} label="Report this gathering" />
          </section>
        </div>
      </div>
    </article>
  );
}
