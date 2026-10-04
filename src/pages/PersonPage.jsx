import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import EventCard from '../components/EventCard.jsx';
import ReportButton from '../components/ReportButton.jsx';
import Avatar from '../components/Avatar.jsx';
import { HostRating, Stars } from '../components/Stars.jsx';

const lower = (list) => (list || []).map((x) => x.toLowerCase());

function Pills({ items, kind }) {
  return <div className="chips">{items.map((v) => <span key={v} className={`pill pill-${kind}`}>{v}</span>)}</div>;
}

export default function PersonPage() {
  const { id } = useParams();
  const { user, profile: me } = useAuth();
  const [p, setP] = useState(undefined);
  const [events, setEvents] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [age, setAge] = useState(null);
  const [rating, setRating] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      setP(data ?? null);
      const { data: a } = await supabase.rpc('profile_age', { pid: id });
      setAge(typeof a === 'number' ? a : null);
      const [{ data: hr }, { data: rv }] = await Promise.all([
        supabase.rpc('host_ratings', { hids: [id] }),
        supabase.rpc('host_review_list', { hid: id }),
      ]);
      setRating(hr?.[0] ?? null);
      setReviews(rv || []);
      const { data: ev } = await supabase.from('events').select('*').eq('host_id', id)
        .gte('starts_at', new Date().toISOString()).order('starts_at');
      setEvents(ev || []);
      const { data: b } = await supabase.from('blocks').select('blocked_id').eq('blocked_id', id).maybeSingle();
      setBlocked(Boolean(b));
    })();
  }, [id, user]);

  if (!user) return <p className="pad"><Link to="/signin">Sign in</Link> to see profiles.</p>;
  if (p === undefined) return <p className="pad muted">Loading…</p>;
  if (p === null) return <p className="pad">This profile isn't available.</p>;

  const isMe = user.id === id;
  const toggleBlock = async () => {
    if (blocked) await supabase.from('blocks').delete().eq('blocked_id', id);
    else await supabase.from('blocks').insert({ blocked_id: id });
    setBlocked(!blocked);
  };

  const likes = p.likes || [];
  const dislikes = p.dislikes || [];
  const spots = p.favorite_spots || [];
  const languages = p.languages || [];

  // "You both like…" — overlap between the viewer and this person
  const shared = isMe || !me ? [] : [
    ...likes.filter((x) => lower(me.likes).includes(x.toLowerCase())),
    ...spots.filter((x) => lower(me.favorite_spots).includes(x.toLowerCase())),
    ...(p.vibes || []).filter((x) => (me.vibes || []).includes(x)),
  ].slice(0, 6);

  const intro = [
    p.pronouns && { ico: '🙂', text: p.pronouns },
    p.neighborhood && { ico: '🏡', text: <>Lives in <strong>{p.neighborhood}</strong></> },
    p.hometown && { ico: '📍', text: <>From <strong>{p.hometown}</strong></> },
    p.austin_since && { ico: '🌵', text: <>In Austin since <strong>{p.austin_since}</strong></> },
    p.work && { ico: '💼', text: p.work },
    languages.length > 0 && { ico: '💬', text: <>Speaks {languages.join(', ')}</> },
    age !== null && { ico: '🎂', text: `${age} years old` },
    p.verified && { ico: '✅', text: 'Verified by Out & About' },
  ].filter(Boolean);

  const emptyAbout = !p.bio && intro.length === 0 && !likes.length && !dislikes.length && !spots.length && !p.perfect_weekend && !p.ask_me_about;

  return (
    <div className="profile">
      <div className="profile-cover" style={{ background: p.cover_color || 'var(--leaf)' }} aria-hidden="true" />
      <div className="profile-id">
        <Avatar name={p.display_name} url={p.avatar_url} alt={`${p.display_name}'s profile photo`} />
        <div className="profile-name">
          <h1>{p.display_name}</h1>
          <p className="small" style={{ margin: 0 }}>
            {p.verified ? 'Verified' : 'Not verified yet'}{p.neighborhood ? ` · ${p.neighborhood}` : ''}
          </p>
          {(rating?.review_count > 0 || events.length > 0) && <HostRating rating={rating} />}
        </div>
        {isMe && <div className="profile-actions"><Link to="/me" className="btn btn-sm">Edit profile</Link></div>}
      </div>

      <div className="profile-grid">
        <aside className="profile-col">
          <section className="panel">
            <h3>Intro</h3>
            {p.bio && <p>{p.bio}</p>}
            {intro.length > 0 && (
              <ul className="intro">
                {intro.map((row, i) => <li key={i}><span className="ico" aria-hidden="true">{row.ico}</span><span>{row.text}</span></li>)}
              </ul>
            )}
            {!p.bio && intro.length === 0 && <p className="muted small">{isMe ? 'Add a bio and a few details on your Me page.' : 'No intro yet.'}</p>}
          </section>
          {(p.vibes || []).length > 0 && (
            <section className="panel"><h3>Vibes</h3><Pills items={p.vibes} kind="like" /></section>
          )}
        </aside>

        <div className="profile-col">
          {shared.length > 0 && (
            <section className="panel common"><strong>You both like:</strong> {shared.join(', ')}</section>
          )}
          {p.perfect_weekend && (
            <section className="panel"><h3>My perfect Austin weekend</h3><p className="quote">"{p.perfect_weekend}"</p></section>
          )}
          {likes.length > 0 && <section className="panel"><h3>Likes</h3><Pills items={likes} kind="like" /></section>}
          {dislikes.length > 0 && <section className="panel"><h3>Not my thing</h3><Pills items={dislikes} kind="nope" /></section>}
          {spots.length > 0 && <section className="panel"><h3>Favorite spots</h3><Pills items={spots} kind="spot" /></section>}
          {p.ask_me_about && <section className="panel"><h3>Ask me about</h3><p style={{ margin: 0 }}>{p.ask_me_about}</p></section>}
          {emptyAbout && isMe && (
            <section className="panel"><p style={{ margin: 0 }}>Your profile is looking quiet. <Link to="/me">Add likes, favorite spots, and more</Link> so people know who they're meeting.</p></section>
          )}

          <section>
            <h2>Hosting soon</h2>
            <div className="stack">{events.map((e) => <EventCard key={e.id} event={e} />)}</div>
            {events.length === 0 && <p className="muted">Nothing coming up.</p>}
          </section>

          {reviews.length > 0 && (
            <section>
              <h2>What guests say</h2>
              <ul className="review-list">
                {reviews.map((r) => (
                  <li key={r.review_id} className="review">
                    <p><Stars value={r.rating} /> <span className="small muted">{r.event_title}{r.event_date ? ` · ${new Date(r.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span></p>
                    {r.comment && <p>{r.comment}</p>}
                    <p className="small muted">{r.reviewer_name ? <Link to={`/people/${r.reviewer_id}`}>{r.reviewer_name}</Link> : 'A guest'}, who went</p>
                    {user.id !== r.reviewer_id && <ReportButton targetType="review" targetId={r.review_id} label="Report review" />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      {!isMe && (
        <div className="row profile-foot">
          <button type="button" className="linkish" onClick={toggleBlock}>{blocked ? 'Unblock' : 'Block'}</button>
          <ReportButton targetType="user" targetId={id} label="Report this person" />
        </div>
      )}
    </div>
  );
}
