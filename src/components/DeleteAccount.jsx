import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

function storagePath(url) {
  const marker = '/avatars/';
  const i = url ? url.indexOf(marker) : -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

// Lets a member permanently erase their own account and everything tied to it.
export default function DeleteAccount() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const erase = async () => {
    setBusy(true); setError('');
    const path = storagePath(profile?.avatar_url);
    if (path) await supabase.storage.from('avatars').remove([path]);
    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) { setBusy(false); setError(err.message); return; }
    await signOut().catch(() => {});
    nav('/', { replace: true, state: { deleted: true } });
  };

  if (!open) {
    return (
      <section className="danger-zone">
        <h2>Delete my account</h2>
        <p className="small">Permanently remove your account, profile, photo, gatherings you host, RSVPs, posts, and reviews you wrote.</p>
        <button type="button" className="btn btn-outline btn-danger" onClick={() => setOpen(true)}>Delete my account…</button>
      </section>
    );
  }

  return (
    <section className="danger-zone">
      <h2>Are you sure?</h2>
      <p className="small">This can't be undone. Guests of any gatherings you're hosting will get a cancellation email. If you just want a break, you can turn off emails and sign out instead.</p>
      <label className="field">Type DELETE to confirm
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="btn btn-danger-solid" disabled={typed.trim().toUpperCase() !== 'DELETE' || busy} onClick={erase}>
          {busy ? 'Deleting…' : 'Delete my account forever'}
        </button>
        <button type="button" className="linkish" onClick={() => { setOpen(false); setTyped(''); setError(''); }} disabled={busy}>Cancel</button>
      </div>
    </section>
  );
}
