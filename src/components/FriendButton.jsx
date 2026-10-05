import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

// Add friend / Request sent / Accept / Friends + Message.
// Messaging unlocks only once a friend request is accepted.
export default function FriendButton({ personId, name = 'them', status: initial, onChange, showUnfriend = false }) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (initial !== undefined) setStatus(initial); }, [initial]);
  useEffect(() => {
    if (initial !== undefined || !user || user.id === personId) return;
    supabase.rpc('friend_status', { p_other: personId }).then(({ data }) => setStatus(data || 'none'));
  }, [initial, personId, user]);

  if (!user || !profile || user.id === personId || status === null || status === 'blocked') return null;

  const run = async (fn, next) => {
    setBusy(true); setError('');
    const { data, error: err } = await fn();
    setBusy(false);
    if (err) { setError(err.message); return; }
    const s = typeof data === 'string' ? data : next;
    setStatus(s); onChange?.(s);
  };
  const send = () => run(() => supabase.rpc('send_friend_request', { p_other: personId }), 'outgoing');
  const remove = (confirmText) => { if (!confirmText || window.confirm(confirmText)) run(() => supabase.rpc('remove_friend', { p_other: personId }), 'none'); };
  const respond = (accept) => run(() => supabase.rpc('respond_friend_request', { p_other: personId, p_accept: accept }), accept ? 'friends' : 'none');

  return (
    <div className="friend-btn">
      {status === 'none' && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Add friend'}</button>}
      {status === 'outgoing' && <>
        <span className="pill">Request sent</span>
        <button type="button" className="linkish small" disabled={busy} onClick={() => remove()}>Cancel</button>
      </>}
      {status === 'incoming' && <>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => respond(true)}>Accept friend request</button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => respond(false)}>Decline</button>
      </>}
      {status === 'friends' && <>
        <Link to={`/messages/${personId}`} className="btn btn-primary btn-sm">Message</Link>
        <span className="pill pill-like">Friends ✓</span>
        {showUnfriend && <button type="button" className="linkish small" disabled={busy}
          onClick={() => remove(`Unfriend ${name}? You won't be able to message each other unless you're friends again.`)}>Unfriend</button>}
      </>}
      {error && <p className="error small" role="alert" style={{ margin: 0, flexBasis: '100%' }}>{error}</p>}
    </div>
  );
}
