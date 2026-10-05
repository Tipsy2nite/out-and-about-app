import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { COVER_COLORS, DISLIKE_SUGGESTIONS, LIKE_SUGGESTIONS, SPOT_SUGGESTIONS, STAGES, VIBES } from '../lib/constants.js';
import { ChipGroup } from '../components/Chip.jsx';
import TagInput from '../components/TagInput.jsx';
import PhotoPicker from '../components/PhotoPicker.jsx';
import DeleteAccount from '../components/DeleteAccount.jsx';
import InstallApp from '../components/InstallApp.jsx';

export default function MePage() {
  const { user, profile, refreshProfile, signOut, isAdmin } = useAuth();
  const [f, setF] = useState(null);
  const [trusted, setTrusted] = useState('');
  const [mail, setMail] = useState({ email_plan_changes: true, email_reminders: true, email_new_rsvps: true });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setF({
      display_name: profile.display_name, neighborhood: profile.neighborhood || '', bio: profile.bio || '',
      vibes: profile.vibes, parent_role: profile.parent_role || '', kids_stages: profile.kids_stages,
      show_in_parent_finder: profile.show_in_parent_finder, hide_from_guest_lists: profile.hide_from_guest_lists,
      hide_age: Boolean(profile.hide_age),
      pronouns: profile.pronouns || '', hometown: profile.hometown || '', work: profile.work || '',
      austin_since: profile.austin_since ? String(profile.austin_since) : '',
      languages: profile.languages || [], likes: profile.likes || [], dislikes: profile.dislikes || [],
      favorite_spots: profile.favorite_spots || [], perfect_weekend: profile.perfect_weekend || '',
      ask_me_about: profile.ask_me_about || '', cover_color: profile.cover_color || '',
    });
  }, [profile]);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('profile_private')
        .select('trusted_contact_email, email_plan_changes, email_reminders, email_new_rsvps').eq('user_id', user.id).maybeSingle();
      setTrusted(p?.trusted_contact_email || '');
      if (p) setMail({ email_plan_changes: p.email_plan_changes !== false, email_reminders: p.email_reminders !== false, email_new_rsvps: p.email_new_rsvps !== false });
    })();
  }, [user]);

  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaved('');
    const { error } = await supabase.from('profiles').update({
      ...f, parent_role: f.parent_role || null, neighborhood: f.neighborhood || null, bio: f.bio || null,
      pronouns: f.pronouns.trim() || null, hometown: f.hometown.trim() || null, work: f.work.trim() || null,
      austin_since: f.austin_since ? Number(f.austin_since) : null,
      perfect_weekend: f.perfect_weekend.trim() || null, ask_me_about: f.ask_me_about.trim() || null,
      cover_color: f.cover_color || null,
    }).eq('id', user.id);
    const { error: e2 } = await supabase.from('profile_private').update({ trusted_contact_email: trusted || null, ...mail }).eq('user_id', user.id);
    setSaved(error || e2 ? `Didn't save: ${(error || e2).message}` : 'Saved.');
    refreshProfile();
  };

  return (
    <div className="pad narrow">
      <div className="edit-head">
        <Link to={`/people/${user.id}`} className="back">← Back to my profile</Link>
        <h1 className="page-title">Edit profile &amp; settings</h1>
      </div>
      <form className="stack form" onSubmit={save}>
        <h2>Profile</h2>
        <PhotoPicker />
        <label className="field">Name<input required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></label>
        <label className="field">Neighborhood<input value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} /></label>
        <label className="field">About you<textarea rows={3} maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
        <fieldset><legend>My vibes</legend><ChipGroup multi options={VIBES} value={f.vibes} onChange={(v) => setF({ ...f, vibes: v })} /></fieldset>

        <h2 className="about-head">About me</h2>
        <p className="small muted" style={{ marginTop: -8 }}>All optional. Members who are signed in can see these on your profile.</p>
        <label className="field">Pronouns<input maxLength={30} value={f.pronouns} onChange={set('pronouns')} placeholder="she/her, he/him, they/them…" /></label>
        <label className="field">Where are you from?<input maxLength={60} value={f.hometown} onChange={set('hometown')} placeholder="San Antonio, TX" /></label>
        <label className="field">In Austin since (year)<input type="number" inputMode="numeric" min={1930} max={new Date().getFullYear()} value={f.austin_since} onChange={set('austin_since')} placeholder="2019" /></label>
        <label className="field">What do you do?<input maxLength={80} value={f.work} onChange={set('work')} placeholder="Teacher at…, nurse, student at UT, retired…" /></label>
        <TagInput label="Languages" value={f.languages} onChange={(v) => setF({ ...f, languages: v })} max={8} maxLength={24}
          suggestions={['English', 'Spanish', 'ASL', 'Vietnamese', 'Mandarin', 'Hindi', 'French']} placeholder="Add a language" />
        <TagInput label="Likes" hint="Things you're into. Press Enter after each one." value={f.likes} onChange={(v) => setF({ ...f, likes: v })} max={20}
          suggestions={LIKE_SUGGESTIONS} placeholder="Tacos, birding, 90s R&B…" />
        <TagInput label="Not my thing" hint="Helps hosts and new friends know what to skip." value={f.dislikes} onChange={(v) => setF({ ...f, dislikes: v })} max={20}
          suggestions={DISLIKE_SUGGESTIONS} placeholder="Cilantro, loud bars…" />
        <TagInput label="Favorite spots to visit" value={f.favorite_spots} onChange={(v) => setF({ ...f, favorite_spots: v })} max={15} maxLength={60}
          suggestions={SPOT_SUGGESTIONS} placeholder="Parks, patios, trails, shops…" />
        <label className="field">My perfect Austin weekend
          <textarea rows={2} maxLength={280} value={f.perfect_weekend} onChange={set('perfect_weekend')} placeholder="Breakfast tacos, a swim at Barton Springs, then live music on the east side." /></label>
        <label className="field">Ask me about
          <input maxLength={140} value={f.ask_me_about} onChange={set('ask_me_about')} placeholder="My sourdough starter, the best swimming holes…" /></label>
        <fieldset><legend>Profile cover color</legend>
          <div className="swatches" role="radiogroup" aria-label="Profile cover color">
            {COVER_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={f.cover_color === c} aria-label={`Cover color ${c}`}
                className="swatch" style={{ background: c }} onClick={() => setF({ ...f, cover_color: c })} />
            ))}
          </div>
        </fieldset>
        <fieldset><legend>Parent hubs</legend>
          <ChipGroup options={[['', 'Not a parent'], ['mom', 'Mom'], ['dad', 'Dad']]} value={f.parent_role} onChange={(v) => setF({ ...f, parent_role: v })} />
          {f.parent_role && <>
            <span className="small strong">Kids' age ranges</span>
            <ChipGroup multi options={STAGES} value={f.kids_stages} onChange={(v) => setF({ ...f, kids_stages: v })} />
            <label className="check"><input type="checkbox" checked={f.show_in_parent_finder} onChange={(e) => setF({ ...f, show_in_parent_finder: e.target.checked })} />
              Show me in "{f.parent_role === 'mom' ? 'Moms' : 'Dads'} near you"</label>
          </>}
        </fieldset>
        <h2>Safety &amp; privacy</h2>
        <label className="check"><input type="checkbox" checked={f.hide_from_guest_lists} onChange={(e) => setF({ ...f, hide_from_guest_lists: e.target.checked })} />
          Hide me from guest lists</label>
        <label className="check"><input type="checkbox" checked={f.hide_age} onChange={(e) => setF({ ...f, hide_age: e.target.checked })} />
          Hide my age on my profile</label>
        <fieldset><legend>Email me when…</legend>
          <label className="check"><input type="checkbox" checked={mail.email_plan_changes} onChange={(e) => setMail({ ...mail, email_plan_changes: e.target.checked })} />
            A gathering I'm going to changes or is cancelled</label>
          <label className="check"><input type="checkbox" checked={mail.email_reminders} onChange={(e) => setMail({ ...mail, email_reminders: e.target.checked })} />
            The day before a gathering I'm going to or hosting</label>
          <label className="check"><input type="checkbox" checked={mail.email_new_rsvps} onChange={(e) => setMail({ ...mail, email_new_rsvps: e.target.checked })} />
            Someone RSVPs to a gathering I'm hosting</label>
        </fieldset>
        <label className="field">Trusted contact's email (for "Tell a friend where you'll be")
          <input type="email" value={trusted} onChange={(e) => setTrusted(e.target.value)} /></label>
        <button type="submit" className="btn btn-primary">Save changes</button>
        {saved && <p className="small" role="status">{saved}{saved === 'Saved.' && <> <Link to={`/people/${user.id}`}>See my profile</Link></>}</p>}
        <p className="small"><Link to="/guidelines">Community guidelines &amp; safety center</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link></p>
        <InstallApp variant="settings" />
        {isAdmin && <p><Link to="/admin" className="btn btn-sm">Admin: reports</Link></p>}
        <button type="button" className="btn btn-outline" onClick={signOut}>Sign out</button>
        <DeleteAccount />
      </form>
    </div>
  );
}
