import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { forgetGuestToken } from '../lib/guestRsvp.js';
import { eventDateParts } from '../lib/format.js';

// Opened from the "Cancel your RSVP" link in a guest's emails.
export default function GuestCancel() {
  const { token } = useParams();
  const [rsvp, setRsvp] = useState(undefined);
  const [state, setState] = useState('idle'); // idle | busy | done | error

  useEffect(() => {
    supabase.rpc('guest_rsvp_lookup', { tok: token }).then(({ data }) => setRsvp(data?.[0] ?? null));
  }, [token]);

  const cancel = async () => {
    setState('busy');
    const { error } = await supabase.rpc('guest_rsvp_cancel', { tok: token });
    if (error) { setState('error'); return; }
    forgetGuestToken(rsvp.event_id);
    setState('done');
  };

  if (rsvp === undefined) return <p className="pad muted">Loading…</p>;

  return (
    <div className="pad narrow center-col">
      {state === 'done' ? (
        <>
          <h1 className="page-title">RSVP cancelled</h1>
          <p>Thanks for letting the host know. You won't get any more emails about this gathering.</p>
          <Link to="/" className="btn btn-primary">See what else is happening</Link>
        </>
      ) : rsvp === null ? (
        <>
          <h1 className="page-title">Nothing to cancel</h1>
          <p>This RSVP was already cancelled, or the gathering was removed.</p>
          <Link to="/" className="btn btn-primary">Back to Explore</Link>
        </>
      ) : (
        <>
          <h1 className="page-title">Cancel your RSVP?</h1>
          <p><strong>{rsvp.title}</strong><br />{eventDateParts(rsvp.starts_at).long} · {eventDateParts(rsvp.starts_at).time}</p>
          {state === 'error' && <p className="error">That didn't go through. Try again in a moment.</p>}
          <button type="button" className="btn btn-primary btn-wide" onClick={cancel} disabled={state === 'busy'}>Yes, cancel my RSVP</button>
          <Link to={`/events/${rsvp.event_id}`} className="linkish">Keep it and view the gathering</Link>
        </>
      )}
    </div>
  );
}
