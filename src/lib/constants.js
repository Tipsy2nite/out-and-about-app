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

export const TAGS = ['Kid-friendly', 'Dog-friendly', 'Sober-friendly', 'Beginner-friendly', 'Come solo', 'New to Austin welcome', 'Adults only', 'Bring a chair'];

// "Who's it for?" tiles on the front page. Each one filters the gatherings below it.
// match() decides which gatherings show for that tile.
export const AUDIENCES = [
  { key: 'friends', title: 'For friends', blurb: 'Round up the group chat', tint: '#F9DCCB',
    match: (e) => ['Parties', 'Music', 'Parks'].includes(e.category) },
  { key: 'fun', title: 'For fun', blurb: 'Music, games, good times', tint: '#E6DDF3',
    match: (e) => ['Music', 'Parties', 'Niche'].includes(e.category) },
  { key: 'families', title: 'For families', blurb: 'Bring the kids along', tint: '#DCEBD6',
    match: (e) => e.category === 'Families' || e.tags.includes('Kid-friendly') },
  { key: 'new-friends', title: 'Making new friends', blurb: 'Open invites, come solo', tint: '#F5E6B3',
    match: (e) => e.open_invite && (e.tags.includes('Come solo') || e.tags.includes('Beginner-friendly') || e.category === 'Community' || e.size !== 'Crowd') },
  { key: 'new-to-austin', title: 'New to Austin', blurb: 'Find your spots and people', tint: '#CDEBE4',
    match: (e) => e.open_invite && (e.tags.includes('New to Austin welcome') || e.tags.includes('Come solo') || e.category === 'Community' || e.category === 'Parks') },
];

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

// Profile "About me" helpers
export const COVER_COLORS = ['#DCEBD6', '#F9DCCB', '#E6DDF3', '#D5E5F0', '#F5E6B3', '#FBD9E5', '#CDEBE4', '#F2A541'];
export const LIKE_SUGGESTIONS = ['Picnics', 'Live music', 'Tacos', 'Dogs', 'Board games', 'Hiking', 'Kayaking', 'Coffee', 'Thrifting', 'Trivia', 'Yoga', 'Food trucks', 'Sunsets', 'Pickleball', 'Reading', 'Karaoke'];
export const DISLIKE_SUGGESTIONS = ['Being late', 'Loud crowds', 'Small talk', 'Heat waves', 'Flaky plans', 'Traffic', 'Mosquitoes'];
export const SPOT_SUGGESTIONS = ['Zilker Park', 'Barton Springs Pool', 'Lady Bird Lake trail', 'Mount Bonnell', 'Pease Park', 'Mueller Lake Park', 'Auditorium Shores', 'South Congress', 'Butler Park', 'McKinney Falls', 'Hamilton Pool', 'Mayfield Park', 'Republic Square', 'Walter E. Long Lake'];

// Discover: what people are looking for (shown as chips on their card)
export const LOOKING_FOR = ['New friends', 'A friend group', 'Activity buddies', 'Parent friends', 'People new to town', 'Workout partners'];

// How precisely others see where you are. Never an exact address.
export const AREA_LEVELS = [
  ['neighborhood', 'Neighborhood'],
  ['city', 'City only'],
  ['state', 'State only'],
];

// The part of someone's location they've chosen to share
export function areaLabel(p) {
  if (!p) return '';
  const t = (s) => (s || '').trim();
  if (p.area_level === 'state') return t(p.state);
  if (p.area_level === 'city') return [t(p.city), t(p.state)].filter(Boolean).join(', ');
  return [t(p.neighborhood), t(p.city)].filter(Boolean).join(', ');
}
