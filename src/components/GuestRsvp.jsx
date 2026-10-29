import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { forgetGuestToken, saveGuestToken, savedGuestToken } from '../lib/guestRsvp.js';

// What a signed-out visitor sees instead of "I'm going":
// make an account, sign in, or RSVP as a guest (name + email).
export default function GuestRsvp({ event, disabled, onChange }) {
  const nav = useNavigate();
  const from = `/events/${event.id}`;
  const [step, setStep] = useState('button'); // button | choose | form
  const [guest, setGuest] = useState(null);   // { token, name } when RSVP'd as a guest
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Came back to a gathering they already RSVP'd to as a guest?
  useEffect(() => {
    const token = savedGuestToken(event.id);
    if (!token) return;
    supabase.rpc('guest_rsvp_lookup', { tok: token }).then(({ data }) => {
      if (data?.[0]) setGuest({ token, name: data[0].name });
      else forgetGuestToken(event.id); // cancelled from the email link
    });
  }, [event.id]);

  const join = () => nav('/signin', { state: { from, mode: 'signup' } });
  const signIn = () => nav('/signin', { state: { from } });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { data, error: err } = await supabase.rpc('guest_rsvp', { eid: event.id, p_name: name, p_email: email });
    setBusy(false);
    if (err) { setError(err.message); return; }
    saveGuestToken(event.id, data);
    setGuest({ token: data, name: name.trim() });
    setStep('button');
    onChange?.();
  };

  const cancel = async () => {
    if (!window.confirm('Cancel your RSVP?')) return;
    setBusy(true);
    await supabase.rpc('guest_rsvp_cancel', { tok: guest.token });
    forgetGuestToken(event.id);
    setGuest(null);
    setBusy(false);
    onChange?.();
  };

  if (guest) {
    return (
      <section className="panel panel-guest">
        <h3>You're in, {guest.name}!</h3>
        <p className="small">You RSVP'd as a guest. We emailed you a confirmation and will let you know if plans change.</p>
        <p className="small">
          {event.is_private_location
            ? 'This one is at a private home, so the exact address is only for members. Make a free account with the same email to unlock it and see who else is coming.'
            : 'Make a free account with the same email to see who else is coming and keep track of your plans.'}
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary btn-sm" onClick={join}>Make my account</button>
          <button type="button" className="linkish" onClick={cancel} disabled={busy}>Cancel my RSVP</button>
        </div>
      </section>
    );
  }

  // The host approves each guest, so they need a profile to look at
  if (!event.open_invite) {
    return step === 'button'
      ? <button type="button" className="btn btn-primary btn-wide" onClick={() => setStep('choose')} disabled={disabled}>
          {disabled ? 'This gathering is cancelled' : 'Ask to join'}
        </button>
      : <section className="panel panel-guest">
          <h3>This host approves each guest</h3>
          <p className="small">Make a free account so the host can see a little about you. Once they approve you, you'll see {event.is_private_location ? 'the address and ' : ''}who else is coming.</p>
          <div className="stack">
            <button type="button" className="btn btn-primary btn-wide" onClick={join}>Make a free account</button>
          </div>
          <p className="small">Already a member? <button type="button" className="linkish" onClick={signIn}>Sign in</button></p>
        </section>;
  }

  if (step === 'button') {
    return (
      <button type="button" className="btn btn-primary btn-wide" onClick={() => setStep('choose')} disabled={disabled}>
        {disabled ? 'This gathering is cancelled' : "I'm going"}
      </button>
    );
  }

  if (step === 'choose') {
    return (
      <section className="panel panel-guest">
        <h3>How do you want to RSVP?</h3>
        <div className="stack">
          <button type="button" className="btn btn-primary btn-wide" onClick={join}>Make a free account</button>
          <p className="small muted guest-perk">See who else is going, unlock private-home addresses, join Circles, and host your own gatherings.</p>
          <button type="button" className="btn btn-outline btn-wide" onClick={() => setStep('form')}>Continue as a guest</button>
          <p className="small muted guest-perk">Just your name and email. {event.is_private_location ? 'Private-home addresses stay hidden until you make an account.' : 'We only email you about this gathering.'}</p>
        </div>
        <p className="small">Already a member? <button type="button" className="linkish" onClick={signIn}>Sign in</button></p>
      </section>
    );
  }

  return (
    <section className="panel panel-guest">
      <h3>RSVP as a guest</h3>
      <form className="form" onSubmit={submit}>
        <label className="field">Your name
          <input required maxLength={60} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should the host call you?" />
        </label>
        <label className="field">Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="small muted">For your confirmation and updates if plans change. Never shown to anyone.</span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-wide" disabled={busy}>{busy ? 'One sec…' : "Count me in"}</button>
        <button type="button" className="linkish" onClick={() => setStep('choose')}>Back</button>
      </form>
    </section>
  );
}
