import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

const MIN_PASSWORD = 8;

// Email + password auth. New accounts confirm their email once; after that
// people sign in with their password — no more emailed sign-in links.
export default function SignIn() {
  const { user, profile } = useAuth();
  const loc = useLocation();
  const [mode, setMode] = useState(loc.state?.mode === 'signup' ? 'signup' : 'signin'); // signin | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { title, body }
  const [unconfirmed, setUnconfirmed] = useState(false);

  if (user) return <Navigate to={profile ? (loc.state?.from || '/') : '/welcome'} replace />;

  const back = loc.state?.from ? `#${loc.state.from}` : '';
  const redirectTo = `${window.location.origin}/${back}`;

  const switchMode = (next) => { setMode(next); setError(''); setNotice(null); setUnconfirmed(false); };

  const signIn = async () => {
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (!err) return;
    if (/not confirmed/i.test(err.message)) {
      setUnconfirmed(true);
      setError("You haven't confirmed your email yet. Check your inbox (and spam) for the confirmation email.");
    } else if (/invalid login credentials/i.test(err.message)) {
      setError('That email and password don’t match. If you joined before passwords existed, tap "Forgot password?" to set one.');
    } else setError(err.message);
  };

  const signUp = async () => {
    if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters for your password.`); return; }
    const { data, error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (err) { setError(err.message); return; }
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      setMode('signin');
      setError('That email already has an account. Sign in below, or use "Forgot password?" to set a new password.');
      return;
    }
    if (data.session) return; // confirmation turned off — already signed in
    setNotice({
      title: 'Confirm your email',
      body: <>We sent a confirmation link to <strong>{email}</strong>. Tap it once to activate your account — after that you'll just sign in with your password.</>,
    });
  };

  const forgot = async () => {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/#/reset-password` });
    if (err) { setError(err.message); return; }
    setNotice({
      title: 'Check your email',
      body: <>If <strong>{email}</strong> has an account, we sent a link to set a new password. Open it on this device.</>,
    });
  };

  const resend = async () => {
    setBusy(true);
    const { error: err } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    if (err) setError(err.message);
    else setNotice({ title: 'Confirmation sent', body: <>We sent a new confirmation link to <strong>{email}</strong>.</> });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setUnconfirmed(false);
    try {
      if (mode === 'signin') await signIn();
      else if (mode === 'signup') await signUp();
      else await forgot();
    } finally { setBusy(false); }
  };

  const title = mode === 'signup' ? 'Join Out & About' : mode === 'forgot' ? 'Reset your password' : 'Welcome back';

  return (
    <div className="pad narrow center-col">
      <h1 className="page-title">{title}</h1>

      {notice ? (
        <div className="panel">
          <h3>{notice.title}</h3>
          <p>{notice.body}</p>
          <button type="button" className="linkish" onClick={() => switchMode('signin')}>Back to sign in</button>
        </div>
      ) : (
        <>
          {mode !== 'forgot' && (
            <div className="chips" role="tablist" aria-label="Sign in or create an account" style={{ marginBottom: 16 }}>
              <button type="button" role="tab" aria-selected={mode === 'signin'} className={`chip ${mode === 'signin' ? 'chip-on' : ''}`} onClick={() => switchMode('signin')}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={`chip ${mode === 'signup' ? 'chip-on' : ''}`} onClick={() => switchMode('signup')}>Create account</button>
            </div>
          )}

          <form className="form" onSubmit={submit}>
            {mode === 'forgot' && <p className="muted">Enter your email and we'll send you a link to set a new password.</p>}
            <label className="field">Email
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode !== 'forgot' && (
              <label className="field">Password
                <input
                  type="password" required minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'signup' && <span className="small muted">At least {MIN_PASSWORD} characters.</span>}
              </label>
            )}

            {error && <p className="error" role="alert">{error}</p>}
            {unconfirmed && <button type="button" className="linkish" onClick={resend} disabled={busy}>Resend confirmation email</button>}

            <button type="submit" className="btn btn-primary btn-wide" disabled={busy}>
              {busy ? 'One sec…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>

            {mode === 'signin' && <button type="button" className="linkish" onClick={() => switchMode('forgot')}>Forgot password?</button>}
            {mode === 'forgot' && <button type="button" className="linkish" onClick={() => switchMode('signin')}>Back to sign in</button>}
            {mode === 'signup' && <p className="small muted">You must be 18 or older to use Out &amp; About.</p>}
          </form>
        </>
      )}
    </div>
  );
}
