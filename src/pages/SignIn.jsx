import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export default function SignIn() {
  const { user, profile } = useAuth();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  if (user) return <Navigate to={profile ? (loc.state?.from || '/') : '/welcome'} replace />;

  const send = async (e) => {
    e.preventDefault();
    setState('sending'); setError('');
    const back = loc.state?.from ? `#${loc.state.from}` : '';
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/${back}` },
    });
    if (err) { setState('idle'); setError(err.message); } else setState('sent');
  };

  return (
    <div className="pad narrow center-col">
      <h1 className="page-title">Sign in or join</h1>
      {state === 'sent' ? (
        <div className="panel">
          <h3>Check your email</h3>
          <p>We sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish.</p>
          <button type="button" className="linkish" onClick={() => setState('idle')}>Use a different email</button>
        </div>
      ) : (
        <form className="form" onSubmit={send}>
          <p className="muted">No password needed. We'll email you a link that signs you in.</p>
          <label className="field">Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-wide" disabled={state === 'sending'}>Email me a sign-in link</button>
          <p className="small muted">You must be 18 or older to use Out &amp; About.</p>
        </form>
      )}
    </div>
  );
}
