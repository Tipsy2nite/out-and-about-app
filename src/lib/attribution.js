// Remembers how a visitor first found the site (the utm_* tags on the link
// they arrived from), so a new account can record where it came from.
// First touch wins: a later visit without tags doesn't overwrite it.
const KEY = 'oa_first_touch';
const TAGS = ['utm_source', 'utm_medium', 'utm_campaign'];

export function captureAttribution() {
  try {
    if (localStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const touch = {};
    TAGS.forEach((t) => { const v = params.get(t); if (v) touch[t] = v.slice(0, 80); });
    if (!Object.keys(touch).length) return;
    touch.landed_at = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch { /* storage blocked: attribution is optional */ }
}

export function getAttribution() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// Options for the "How did you hear about us?" question at sign-up.
export const HEARD_ABOUT = [
  'Instagram',
  'Facebook',
  'A friend',
  'A flyer or sign',
  'At an Out & About gathering',
  'Nextdoor',
  'Do512, Eventbrite or another event site',
  'Reddit',
  'Search (Google, etc.)',
  'Something else',
];
