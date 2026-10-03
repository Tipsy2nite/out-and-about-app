import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import useCircles from './useCircles.js';
import { ChipGroup } from '../components/Chip.jsx';

export function CircleRow({ c, onToggle, signedIn }) {
  return (
    <div className="circle-row">
      <Link to={`/circles/${c.id}`} className="circle-link">
        <span className="avatar avatar-lg">{c.name.charAt(0)}</span>
        <span>
          <strong className="circle-name">{c.name}</strong><br />
          {c.description && <span className="small muted">{c.description}<br /></span>}
          <span className="small strong">{c.level} · {c.members} {c.members === 1 ? 'member' : 'members'}{c.rhythm ? ` · ${c.rhythm}` : ''}</span>
        </span>
      </Link>
      {signedIn && (
        <button type="button" className={c.joined ? 'btn btn-dark btn-sm' : 'btn btn-primary btn-sm'} aria-pressed={c.joined} onClick={() => onToggle(c)}>
          {c.joined ? 'Joined' : 'Join'}
        </button>
      )}
    </div>
  );
}

export default function CirclesPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const { circles, toggleJoin } = useCircles();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ name: '', description: '', rhythm: '', audience: 'everyone' });
  const [error, setError] = useState('');

  const create = async (e) => {
    e.preventDefault();
    const { data, error: err } = await supabase.from('circles').insert(f).select('id').single();
    if (err) return setError(`Couldn't create it: ${err.message}`);
    nav(`/circles/${data.id}`);
  };

  return (
    <div className="pad narrow">
      <h1 className="page-title">Circles</h1>
      <p className="muted">Small, recurring crews for the specific stuff. Circles grow from Sprout to Grove (15+ members) to Forest (50+).</p>

      {user && profile && !creating && (
        <button type="button" className="btn btn-dashed btn-wide" onClick={() => setCreating(true)}>Start a circle for your thing</button>
      )}
      {!user && <p><Link to="/signin">Sign in</Link> to join or start a circle.</p>}

      {creating && (
        <form className="panel form" onSubmit={create}>
          <h3>Start a circle</h3>
          <label className="field">Name<input required minLength={3} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dawn Birders" /></label>
          <label className="field">What's it about?<input maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Early walks, spare binoculars, zero pressure." /></label>
          <label className="field">How often do you meet?<input value={f.rhythm} onChange={(e) => setF({ ...f, rhythm: e.target.value })} placeholder="Most Sunday mornings" /></label>
          <fieldset><legend>Who's it for?</legend>
            <ChipGroup options={[['everyone', 'Everyone'], ['moms', 'Moms'], ['dads', 'Dads']]} value={f.audience} onChange={(v) => setF({ ...f, audience: v })} /></fieldset>
          {error && <p className="error">{error}</p>}
          <div className="row"><button type="submit" className="btn btn-primary">Create circle</button>
            <button type="button" className="linkish" onClick={() => setCreating(false)}>Cancel</button></div>
        </form>
      )}

      {circles === null && <p className="muted">Loading circles…</p>}
      <div className="stack">
        {(circles || []).map((c) => <CircleRow key={c.id} c={c} onToggle={toggleJoin} signedIn={Boolean(user && profile)} />)}
      </div>
      {circles?.length === 0 && <div className="empty"><h3>No circles yet.</h3><p>The first one could be yours.</p></div>}
    </div>
  );
}
