import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

const MIN_PASSWORD = 8;

// Landing page for the "set a new password" email link. The link signs the
// person in for this one step, then they choose a new password.
export default function ResetPassword() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <p className="pad muted">Loading…</p>;
  if (!user) {
    return (
      <div className="pad narrow center-col">
        <h1 className="page-title">Link expired</h1>
        <p>This reset link has expired or was opened on a different device. <Link to="/signin">Request a new one</Link>.</p>
      </div>
    );
  }

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    nav(profile ? '/' : '/welcome', { replace: true });
  };

  return (
    <div className="pad narrow center-col">
      <h1 className="page-title">Set a new password</h1>
      <form className="form" onSubmit={save}>
        <label className="field">New password
          <input type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">Confirm new password
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-wide" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  );
}
