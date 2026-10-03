import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { ACCESS, CATEGORIES, RAIN_PLANS, SIZES, TAGS } from '../lib/constants.js';
import { defaultStart } from '../lib/format.js';
import { ChipGroup } from '../components/Chip.jsx';
import { LocationPicker } from '../components/MapView.jsx';

export default function HostPage() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const verified = Boolean(profile?.verified);

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));
  const onInput = (k) => (e) => set(k)(e.target.type === 'checkbox' ? e.target.checked : e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!pin) return setError('Tap the map to drop a pin where the gathering is.');
    if (f.is_private_location && !f.address.trim()) return setError('Add the exact address. Only guests who RSVP will see it.');
    if (new Date(f.starts_at) < new Date()) return setError('Pick a date and time in the future.');
    setSaving(true);
    const { address, starts_at, ...rest } = f;
    const { data, error: err } = await supabase.from('events')
      .insert({ ...rest, starts_at: new Date(starts_at).toISOString(), lat: pin[0], lng: pin[1] })
      .select('id').single();
    if (err) { setSaving(false); return setError(`Couldn't post it: ${err.message}`); }
    if (f.is_private_location) {
      const { error: locErr } = await supabase.from('event_locations').insert({ event_id: data.id, address: address.trim() });
      if (locErr) { setSaving(false); return setError(`Posted, but the address didn't save: ${locErr.message}`); }
    }
    nav(`/events/${data.id}`);
  };

  return (
    <form className="pad form narrow" onSubmit={submit}>
      <h1 className="page-title">Host a gathering</h1>
      <p className="muted">Big party or three people and a chessboard. Both count.</p>

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
          <input type="checkbox" checked={f.is_private_location} onChange={onInput('is_private_location')} disabled={!verified} />
          It's at a home. Hide the exact address until people RSVP.
        </label>
        {!verified && <p className="small muted">Home gatherings unlock once you're a verified host. During the beta, our team verifies hosts by hand.</p>}
        {f.is_private_location && (
          <label className="field">Exact address (only RSVP'd guests see this)
            <input value={f.address} onChange={onInput('address')} placeholder="Street address" />
          </label>
        )}
        <p className="small">{f.is_private_location ? 'Tap the map near the area, not on the house. Guests see a general circle.' : 'Tap the map to drop a pin on the spot.'}</p>
        <LocationPicker value={pin} onPick={setPin} />
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
      <button type="submit" className="btn btn-primary btn-wide" disabled={saving}>{saving ? 'Posting…' : 'Put it out there'}</button>
    </form>
  );
}
