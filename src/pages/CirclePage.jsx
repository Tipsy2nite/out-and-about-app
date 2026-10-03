import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { circleLevel } from '../lib/constants.js';
import { timeAgo } from '../lib/format.js';
import ReportButton from '../components/ReportButton.jsx';

export default function CirclePage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [c, setC] = useState(undefined);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('circles').select('*, organizer:profiles(id, display_name)').eq('id', id).maybeSingle();
    setC(data ?? null);
    if (!data || !user) return;
    const { data: m } = await supabase.from('circle_members').select('user_id, role, profile:profiles(display_name)').eq('circle_id', id);
    setMembers(m || []);
    const { data: p } = await supabase.from('circle_posts').select('*, author:profiles(id, display_name)').eq('circle_id', id).order('created_at', { ascending: false }).limit(100);
    setPosts(p || []);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  if (c === undefined) return <p className="pad muted">Loading…</p>;
  if (c === null) return <div className="pad empty"><h2>This circle isn't here anymore.</h2><Link to="/circles" className="btn btn-primary">All circles</Link></div>;

  const joined = members.some((m) => m.user_id === user?.id);
  const count = members.length;

  const toggle = async () => {
    if (joined) await supabase.from('circle_members').delete().eq('circle_id', id).eq('user_id', user.id);
    else await supabase.from('circle_members').insert({ circle_id: id });
    load();
  };

  const post = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const { error: err } = await supabase.from('circle_posts').insert({ circle_id: id, body: draft.trim() });
    if (err) return setError(`Didn't post: ${err.message}`);
    setDraft(''); setError(''); load();
  };

  return (
    <div className="pad narrow">
      <Link to="/circles" className="back">All circles</Link>
      <section className="circle-head">
        <p className="small strong">{user ? `${circleLevel(count)} · ${count} members` : 'Sign in to see members'}{c.rhythm ? ` · ${c.rhythm}` : ''}</p>
        <h1>{c.name}</h1>
        {c.description && <p>{c.description}</p>}
        {c.organizer && <p className="small">Organized by <Link to={`/people/${c.organizer.id}`}>{c.organizer.display_name}</Link></p>}
        {user && profile
          ? <button type="button" className={joined ? 'btn btn-dark' : 'btn btn-primary'} onClick={toggle}>{joined ? 'Joined · leave circle' : 'Join this circle'}</button>
          : <Link to="/signin" className="btn btn-primary">Sign in to join</Link>}
      </section>

      <h2>The board</h2>
      {joined ? (
        <form className="form" onSubmit={post}>
          <label className="field"><span className="sr">Write a post</span>
            <textarea rows={3} maxLength={1000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Say hi, share a find, plan a carpool…" /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-sm">Post</button>
        </form>
      ) : <p className="muted">Join the circle to read and post on the board.</p>}

      <div className="stack">
        {posts.map((p) => (
          <div key={p.id} className="post">
            <div className="row-between"><Link to={`/people/${p.author?.id}`} className="strong">{p.author?.display_name}</Link><span className="small muted">{timeAgo(p.created_at)}</span></div>
            <p>{p.body}</p>
            <ReportButton targetType="post" targetId={p.id} />
          </div>
        ))}
        {joined && posts.length === 0 && <p className="muted">Quiet so far. Be the first to post.</p>}
      </div>
      <ReportButton targetType="circle" targetId={c.id} label="Report this circle" />
    </div>
  );
}
