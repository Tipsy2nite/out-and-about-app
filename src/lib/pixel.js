// Meta Pixel: measures which Instagram/Facebook ads lead to sign-ups and RSVPs.
// Paste the Pixel ID from Meta Events Manager below. While it's empty, nothing
// loads and nothing is sent.
export const META_PIXEL_ID = '';

// Respect browsers that send a Global Privacy Control or Do Not Track signal.
function optedOut() {
  try {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  } catch { return false; }
}

const enabled = () => Boolean(META_PIXEL_ID) && import.meta.env.PROD && !optedOut();

export function initPixel() {
  if (!enabled() || window.fbq) return;
  // Meta's standard loader: queues calls until fbevents.js arrives
  const fbq = function (...args) { fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args); };
  fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
  window.fbq = fbq; if (!window._fbq) window._fbq = fbq;
  const s = document.createElement('script');
  s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);

  // No advanced matching: we never pass names, emails or other member details.
  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
  // The site routes with #/… links, so count each in-app page change too
  window.addEventListener('hashchange', () => window.fbq('track', 'PageView'));
}

// Standard event, e.g. track('CompleteRegistration')
export function track(name) {
  try { if (enabled() && window.fbq) window.fbq('track', name); } catch { /* never block the app */ }
}

// Our own event, e.g. trackCustom('RSVP')
export function trackCustom(name) {
  try { if (enabled() && window.fbq) window.fbq('trackCustom', name); } catch { /* never block the app */ }
}
