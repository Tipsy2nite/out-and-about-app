// Guest RSVPs (no account). The secret token lives in this browser so the
// guest sees "you're in" when they come back, and can cancel.
const key = (eventId) => `oa_guest_rsvp_${eventId}`;

export function savedGuestToken(eventId) {
  try { return window.localStorage.getItem(key(eventId)); } catch { return null; }
}
export function saveGuestToken(eventId, token) {
  try { window.localStorage.setItem(key(eventId), token); } catch { /* private mode: fine */ }
}
export function forgetGuestToken(eventId) {
  try { window.localStorage.removeItem(key(eventId)); } catch { /* ignore */ }
}

// The link people share. Always the public site, even when testing locally.
export function inviteLink(eventId) {
  const origin = /localhost|127\.0\.0\.1/.test(window.location.hostname) ? window.location.origin : 'https://outandaboutsocial.net';
  return `${origin}/#/events/${eventId}`;
}
