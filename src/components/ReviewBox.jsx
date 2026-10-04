import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { StarPicker, Stars } from './Stars.jsx';

// Shown on a gathering's page after it happens, to people who RSVP'd.
export default function ReviewBox({ event, onSaved }) {
  const { user } = useAuth();
  const [mine, setMine] = useState(undefined); // undefined = loading, null = none yet
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('host_reviews').select('*').eq('event_id', event.id).eq('reviewer_id', user.id).maybeSingle()
      .then(({ data }) => {
        setMine(data ?? null);
        if (data) { setRating(data.rating); setComment(data.comment || ''); setAnonymous(data.anonymous); }
      });
  }, [event.id, user.id]);

  if (mine === undefined) return null;
  const hostName = event.host?.display_name || 'the host';

  const save = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Tap a star to rate.'); return; }
    setBusy(true); setError('');
    const { data, error: err } = await supabase.from('host_reviews')
      .upsert({ event_id: event.id, rating, comment: comment.trim() || null, anonymous }, { onConflict: 'event_id,reviewer_id' })
      .select().single();
    setBusy(false);
    if (err) { setError(`Couldn't save your review: ${err.message}`); return; }
    setMine(data); setEditing(false);
    onSaved?.();
  };

  const remove = async () => {
    if (!window.confirm('Remove your review?')) return;
    await supabase.from('host_reviews').delete().eq('id', mine.id);
    setMine(null); setRating(0); setComment(''); setAnonymous(false);
    onSaved?.();
  };

  if (mine && !editing) {
    return (
      <section className="panel panel-review">
        <h3>Your review</h3>
        <p><Stars value={mine.rating} /> {mine.anonymous && <span className="small muted">(posted without your name)</span>}</p>
        {mine.comment && <p className="small">"{mine.comment}"</p>}
        <div className="row">
          <button type="button" className="linkish" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="linkish" onClick={remove}>Remove</button>
        </div>
      </section>
    );
  }

  return (
    <form className="panel panel-review form" onSubmit={save}>
      <h3>How was it with {hostName}?</h3>
      <p className="small muted">Your rating helps newcomers find great hosts. Keep it honest and kind.</p>
      <StarPicker value={rating} onChange={setRating} />
      <label className="field">Anything to share? (optional)
        <textarea rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder="Welcoming? Well organized? Would you go again?" />
      </label>
      <label className="check"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        <span>Post without my name</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : mine ? 'Save changes' : 'Post review'}</button>
        {editing && <button type="button" className="linkish" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>
  );
}
