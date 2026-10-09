import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { ACCESS, CATEGORIES, HOST_MIN_AGE, RAIN_PLANS, REQUIRE_VERIFIED_FOR_HOME_EVENTS, SIZES, TAGS } from '../lib/constants.js';
import { defaultStart } from '../lib/format.js';
import { ChipGroup } from '../components/Chip.jsx';
import { LocationPicker } from '../components/MapView.jsx';
import AddressSearch from '../components/AddressSearch.jsx';

// For home gatherings, the public pin lands a short random distance (about 150-300 m)
// from the real address so the house itself is never marked on the map.
function nearby([lat, lng]) {
  const meters = 150 + Math.random() * 150;
  const angle = Math.random() * 2 * Math.PI;
  const dLat = (meters * Math.cos(angle)) / 111320;
  const dLng = (meters * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

export default function HostPage() {
  const { profile, user } = useAuth();
  const nav = useNavigate();
  const { id: editId } = useParams();           // set when editing an existing gathering
  const editing = Boolean(editId);
  const [original, setOriginal] = useState(null); // the gathering as it was before editing
  const [params] = useSearchParams();
  const canHostAtHome = !REQUIRE_VERIFIED_FOR_HOME_EVENTS || Boolean(profile?.verified);
  const [oldEnough, setOldEnough] = useState(null); // null = checking

  useEffect(() => {
    let live = true;
    supabase.rpc('is_21').then(({ data }) => { if (live) setOldEnough(Boolean(data)); });
    return () => { live = false; };
  }, []);

  const [f, setF] = useState({
    title: params.get('title') || '',
    description: '',
    category: params.get('category') || 'Parks',
    audience: params.get('audience') || 'everyone',
    starts_at: defaultStart(),
    area_label: '',
    is_private_location: false,
    address: '',
    size: params.get('size') || 'Cozy',
    open_invite: true,
    tags: params.get('kids') === '1' ? ['Kid-friendly'] : [],
    rain_plan: 'Move to backup spot',
    rain_plan_note: '',
    access_entry: 'Step-free', access_shade: 'Some', access_restrooms: 'Nearby', access_noise: 'Chatty',
    access_notes: '',
  });
  const [pin, setPin] = useState(null);
  const [geo, setGeo] = useState(null);     // exact spot of the address they picked
  const [focus, setFocus] = useState(null); // tells the map where to glide to
  const [loadState, setLoadState] = useState(editing ? 'loading' : 'ready'); // loading | ready | missing | notyours
  const [error, setError] = useState('');

  // When editing, fill the form with the gathering's current details
  useEffect(() => {
    if (!editing || !user) return;
    let live = true;
    (async () => {
      const { data: ev } = await supabase.from('events').select('*').eq('id', editId).maybeSingle();
      if (!live) return;
      if (!ev) { setLoadState('missing'); return; }
      if (ev.host_id !== user.id) { setLoadState('notyours'); return; }
      const { data: loc } = await supabase.from('event_locations').select('address').eq('event_id', editId).maybeSingle();
      if (!live) return;
      const d = new Date(ev.starts_at);
      const pad = (n) => String(n).padStart(2, '0');
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setF({
        title: ev.title, description: ev.description || '', category: ev.category, audience: ev.audience,
        starts_at: local, area_label: ev.area_label, is_private_location: ev.is_private_location, address: loc?.address || ev.address || '',
        size: ev.size, open_invite: ev.open_invite, tags: ev.tags || [], rain_plan: ev.rain_plan, rain_plan_note: ev.rain_plan_note || '',
        access_entry: ev.access_entry, access_shade: ev.access_shade, access_restrooms: ev.access_restrooms, access_noise: ev.access_noise,
        access_notes: ev.access_notes || '',
      });
      setPin([ev.lat, ev.lng]);
      setOriginal({ ...ev, starts_local: local, address: loc?.address || '' });
      setLoadState('ready');
    })();
    return () => { live = false; };
  }, [editing, editId, user]);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));
  const onInput = (k) => (e) => set(k)(e.target.type === 'checkbox' ? e.target.checked : e.target.value);

  // Picking an address moves the pin (and the map) there. Home gatherings get a nearby pin instead.
  useEffect(() => {
    if (!geo) return;
    const spot = f.is_private_location ? nearby(geo) : geo;
    setPin(spot);
    setFocus({ pos: spot, key: Date.now() });
  }, [geo, f.is_private_location]);

  const pickAddress = (r) => {
    setGeo([r.lat, r.lng]);
    // Fill in the public place name if it's empty, but never with a home's street address
    if (!f.is_private_location && !f.area_label.trim()) set('area_label')(r.placeName || r.line1);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!pin) return setError('Add the address (or tap the map) so people know where the gathering is.');
    if (f.is_private_location && !f.address.trim()) return setError('Add the exact address. Only guests who RSVP will see it.');
    const timeChanged = !editing || f.starts_at !== original?.starts_local;
    if (timeChanged && new Date(f.starts_at) < new Date()) return setError('Pick a date and time in the future.');
    setSaving(true);
    const { address, starts_at, ...rest } = f;
    const publicAddress = f.is_private_location ? null : (address.trim() || null); // public spots show the address to everyone

    if (editing) {
      const changes = { ...rest, address: publicAddress, lat: pin[0], lng: pin[1], description: rest.description || null, rain_plan_note: rest.rain_plan_note || null, access_notes: rest.access_notes || null };
      if (timeChanged) changes.starts_at = new Date(starts_at).toISOString();
      const { error: err } = await supabase.from('events').update(changes).eq('id', editId);
      if (err) { setSaving(false); return setError(`Couldn't save: ${err.message}`); }
      if (f.is_private_location && address.trim() !== original.address) {
        const { error: locErr } = await supabase.from('event_locations').upsert({ event_id: editId, address: address.trim() }, { onConflict: 'event_id' });
        if (locErr) { setSaving(false); return setError(`Saved, but the address didn't update: ${locErr.message}`); }
      }
      if (!f.is_private_location && original.address) await supabase.from('event_locations').delete().eq('event_id', editId);
      nav(`/events/${editId}`, { state: { saved: true } });
      return;
    }

    const { data, error: err } = await supabase.from('events')
      .insert({ ...rest, address: publicAddress, starts_at: new Date(starts_at).toISOString(), lat: pin[0], lng: pin[1] })
      .select('id').single();
    if (err) { setSaving(false); return setError(`Couldn't post it: ${err.message}`); }
    if (f.is_private_location) {
      const { error: locErr } = await supabase.from('event_locations').insert({ event_id: data.id, address: address.trim() });
      if (locErr) { setSaving(false); return setError(`Posted, but the address didn't save: ${locErr.message}`); }
    }
    nav(`/events/${data.id}`);
  };

  if (oldEnough === null || loadState === 'loading') return <p className="pad muted">Loading…</p>;
  if (loadState === 'missing') return <div className="pad narrow"><h1 className="page-title">This gathering isn't here anymore</h1><p><Link to="/">Back to Explore</Link></p></div>;
  if (loadState === 'notyours') return <div className="pad narrow"><h1 className="page-title">Only the host can edit this</h1><p><Link to={`/events/${editId}`}>Back to the gathering</Link></p></div>;
  if (!oldEnough) {
    return (
      <div className="pad narrow">
        <h1 className="page-title">Hosting is {HOST_MIN_AGE}+</h1>
        <p>You need to be {HOST_MIN_AGE} or older to host a gathering on Out &amp; About. You can still RSVP, join circles, and meet people.</p>
        <p><Link to="/" className="btn btn-primary">Find something to go to</Link></p>
      </div>
    );
  }

  return (
    <form className="pad form narrow" onSubmit={submit}>
      <h1 className="page-title">{editing ? 'Edit your gathering' : 'Host a gathering'}</h1>
      {editing
        ? <p className="muted">If you change the time, place, or address, everyone who RSVP'd gets an email. To move, postpone, or cancel, use the buttons on the gathering's page.</p>
        : <p className="muted">Big party or three people and a chessboard. Both count.</p>}

      <label className="field">What's happening?
        <input required minLength={3} maxLength={90} value={f.title} onChange={onInput('title')} placeholder="Sunday kite flying" />
      </label>
      <label className="field">Tell people about it
        <textarea rows={4} maxLength={2000} value={f.description} onChange={onInput('description')} placeholder="What to bring, what to expect, how to find you." />
      </label>
      <label className="field">When?
        <input type="datetime-local" required value={f.starts_at} onChange={onInput('starts_at')} />
      </label>

      <fieldset><legend>What kind?</legend><ChipGroup options={CATEGORIES} value={f.category} onChange={set('category')} /></fieldset>
      <fieldset><legend>Who's it for?</legend>
        <ChipGroup options={[['everyone', 'Everyone'], ['moms', 'Moms'], ['dads', 'Dads']]} value={f.audience} onChange={set('audience')} />
      </fieldset>
      <fieldset><legend>How big?</legend><ChipGroup options={SIZES} value={f.size} onChange={set('size')} /></fieldset>
      <fieldset><legend>Good to know</legend><ChipGroup multi options={TAGS} value={f.tags} onChange={set('tags')} /></fieldset>

      <fieldset>
        <legend>Where?</legend>
        <label className="field">Place name people will see
          <input required value={f.area_label} onChange={onInput('area_label')} placeholder="Zilker Park, Great Lawn" />
        </label>
        <label className="check">
          <input type="checkbox" checked={f.is_private_location} onChange={onInput('is_private_location')} disabled={!canHostAtHome} />
          It's at a home. Hide the exact address until people RSVP.
        </label>
        {!canHostAtHome && <p className="small muted">Home gatherings unlock once you're a verified host. During the beta, our team verifies hosts by hand.</p>}
        <AddressSearch
          value={f.address}
          onChange={set('address')}
          onPick={pickAddress}
          label={f.is_private_location ? "Exact address (only RSVP'd guests see this)" : 'Address'}
          placeholder={f.is_private_location ? 'Start typing the street address' : 'Start typing an address or place, like 2100 Barton Springs Rd'}
          hint="Pick a match from the list and the map moves there for you."
        />
        <p className="small">{f.is_private_location
          ? "The pin goes near the address, not on the house. Guests see a general circle until they RSVP."
          : 'Pin in the wrong spot? Tap the map to move it, like to a pavilion or a corner of the park.'}</p>
        <LocationPicker value={pin} onPick={setPin} focus={focus} />
      </fieldset>

      <fieldset>
        <legend>If the weather turns</legend>
        <ChipGroup options={RAIN_PLANS} value={f.rain_plan} onChange={set('rain_plan')} />
        <label className="field">Details (optional)
          <input value={f.rain_plan_note} onChange={onInput('rain_plan_note')} placeholder="Backup spot, decision time, new date…" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Access &amp; comfort</legend>
        {Object.entries(ACCESS).map(([key, a]) => (
          <div key={key} className="sub-field"><span className="small strong">{a.label}</span>
            <ChipGroup options={a.options} value={f[key]} onChange={set(key)} /></div>
        ))}
        <label className="field">Anything else? (parking, seating, terrain)
          <input value={f.access_notes} onChange={onInput('access_notes')} placeholder="Free lot, bring a chair, paved path" />
        </label>
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={f.open_invite} onChange={onInput('open_invite')} />
        Open invite: anyone nearby can see and join
      </label>

      <p className="small">By posting, you agree to the <Link to="/guidelines">Host Agreement and Community Guidelines</Link>.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-wide" disabled={saving}>{saving ? (editing ? 'Saving…' : 'Posting…') : (editing ? 'Save changes' : 'Put it out there')}</button>
    </form>
  );
}
