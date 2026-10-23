import { useState } from 'react';
import { inviteLink } from '../lib/guestRsvp.js';

// "Share invite link": the phone's share sheet when there is one, otherwise copy.
export default function ShareInvite({ event, when, className = 'btn btn-outline btn-wide' }) {
  const [copied, setCopied] = useState(false);
  const url = inviteLink(event.id);
  const text = `Come to "${event.title}" with me, ${when} at ${event.area_label}. RSVP on Out & About:`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt('Copy this invite link:', url); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text, url }); return; }
      catch (e) { if (e?.name === 'AbortError') return; }
    }
    copy();
  };

  return (
    <div className="share-invite">
      <button type="button" className={className} onClick={share}>
        {copied ? 'Invite link copied!' : 'Share invite link'}
      </button>
      <p className="small muted">Anyone with the link can RSVP, with an account or as a guest.</p>
    </div>
  );
}
