export const CATEGORIES = ['Parks', 'Music', 'Parties', 'Community', 'Niche', 'Families'];

export const TINTS = {
  Parks: '#DCEBD6', Music: '#E6DDF3', Parties: '#F9DCCB',
  Community: '#D5E5F0', Niche: '#F5E6B3', Families: '#FBD9E5',
};

export const SIZES = [
  ['Cozy', 'Cozy · 2–10'],
  ['Medium', 'Medium · 10–40'],
  ['Crowd', 'Crowd · 40+'],
];

export const TAGS = ['Kid-friendly', 'Dog-friendly', 'Sober-friendly', 'Beginner-friendly', 'Adults only', 'Bring a chair'];

export const VIBES = ['Parks & picnics', 'Live music', 'Open-invite parties', 'Community days', 'Quiet hangs', 'Games & hobbies', 'Outdoor wellness', 'Family-friendly', 'Late-night'];

export const STAGES = ['Expecting', 'Babies', 'Toddlers', 'School age', 'Teens'];

export const RAIN_PLANS = ['Move to backup spot', 'Postpone', 'Cancel', 'Rain or shine'];

export const ACCESS = {
  access_entry: { label: 'Getting in', options: ['Step-free', 'Some steps', 'Trail or uneven'] },
  access_shade: { label: 'Shade', options: ['Lots', 'Some', 'None'] },
  access_restrooms: { label: 'Restrooms', options: ['On site', 'Nearby', 'None'] },
  access_noise: { label: 'Noise', options: ['Quiet', 'Chatty', 'Loud'] },
};

export const DAD_TEMPLATES = [
  { title: 'Park playdate', blurb: 'Kids play, dads talk. An hour or two at a playground.', size: 'Cozy', kids: true },
  { title: 'Saturday grill out', blurb: 'Pavilion, grill, everyone brings a side.', size: 'Medium', kids: true },
  { title: 'Dad & kid bike ride', blurb: 'Easy trail loop with snack stops built in.', size: 'Cozy', kids: true },
  { title: 'Pickup game while kids play', blurb: 'A court right next to a playground.', size: 'Cozy', kids: true },
  { title: 'Dads-only night out', blurb: 'Patio hang after bedtime. Kids stay home.', size: 'Medium', kids: false },
];

export const AUSTIN = [30.2672, -97.7431];

export const PROJECT_EMAIL = 'outandaboutsocialnet@gmail.com';

export function circleLevel(members) {
  if (members >= 50) return 'Forest';
  if (members >= 15) return 'Grove';
  return 'Sprout';
}

// Hosting rules
export const MIN_AGE = 18;          // to join
export const HOST_MIN_AGE = 21;     // to host any gathering
// false = anyone 21+ can host at home. Set true (and run the REVERT block in
// supabase/2026-10-04_hosting_21_plus.sql) to require hand-verified hosts again.
export const REQUIRE_VERIFIED_FOR_HOME_EVENTS = false;

export function ageFrom(dateStr) {
  const b = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
}
