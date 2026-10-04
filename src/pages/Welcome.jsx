import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { HOST_MIN_AGE, MIN_AGE, VIBES, ageFrom } from '../lib/constants.js';
import { ChipGroup } from '../components/Chip.jsx';

export default function Welcome() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const meta = user?.user_metadata || {};
  const askedAtSignup = Boolean(meta.birthdate);
  const [f, setF] = useState({
    display_name: '', neighborhood: '', birthdate: meta.birthdate || '', hide_age: Boolean(meta.hide_age), vibes: [], agree: false,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <p className="pad muted">Loading…</p>;
  if (!user) return <Navigate to="/signin" replace />;
  if (profile) return <Navigate to={loc.state?.from || '/'} replace />;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const age = ageFrom(f.birthdate);
    if (age === null) return setError('Enter your date of birth.');
    if (age < MIN_AGE) return setError(`Out & About is for adults ${MIN_AGE} and older.`);
    if (!f.agree) return setError('Please agree to the Community Guidelines to continue.');
    setSaving(true);
    const { error: e1 } = await supabase.from('profiles').insert({
      id: user.id, display_name: f.display_name.trim(), neighborhood: f.neighborhood.trim() || null, vibes: f.vibes, hide_age: f.hide_age,
    });
    if (e1) { setSaving(false); return setError(`Couldn't save your profile: ${e1.message}`); }
    const { error: e2 } = await supabase.from('profile_private').insert({ user_id: user.id, birthdate: f.birthdate });
    if (e2) {
      await supabase.from('profiles').delete().eq('id', user.id);
      setSaving(false);
      return setError(`Out & About is for adults ${MIN_AGE} and older.`);
    }
    await refreshProfile();
    nav(loc.state?.from || '/', { replace: true });
  };

  return (
    <form className="pad narrow form" onSubmit={save}>
      <h1 className="page-title">Welcome! Let's set you up.</h1>
      <label className="field">First name or nickname
        <input required maxLength={60} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></label>
      <label className="field">Neighborhood (optional)
        <input value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} placeholder="Bouldin Creek" /></label>
      {!askedAtSignup && (
        <label className="field">Date of birth
          <input type="date" required autoComplete="bday" value={f.birthdate} onChange={(e) => setF({ ...f, birthdate: e.target.value })} />
          <span className="small muted">You must be {MIN_AGE}+ to join and {HOST_MIN_AGE}+ to host. We never show your birthday.</span></label>
      )}
      <label className="check"><input type="checkbox" checked={f.hide_age} onChange={(e) => setF({ ...f, hide_age: e.target.checked })} />
        <span>Hide my age on my profile</span></label>
      <fieldset><legend>What's your vibe? Pick as many as you like.</legend>
        <ChipGroup multi options={VIBES} value={f.vibes} onChange={(v) => setF({ ...f, vibes: v })} /></fieldset>
      <label className="check"><input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />
        <span>I'm {MIN_AGE} or older and agree to the <Link to="/guidelines" target="_blank">Community Guidelines</Link>.</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-wide" disabled={saving}>Let's go outside</button>
    </form>
  );
}
