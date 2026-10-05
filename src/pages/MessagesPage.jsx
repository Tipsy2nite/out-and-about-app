import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import FriendButton from '../components/FriendButton.jsx';
import ReportButton from '../components/ReportButton.jsx';

const POLL_MS = 5000;

function stamp(iso) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Left side: requests, conversations, and friends you haven't messaged yet
function Inbox({ activeId, version, onChanged }) {
  const [convos, setConvos] = useState(null);
  const [people, setPeople] = useState([]);

  const load = useCallback(async () => {
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.rpc('my_conversations'),
      supabase.rpc('my_friends'),
    ]);
    setConvos(c || []);
    setPeople(f || []);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, POLL_MS * 3); return () => clearInterval(t); }, [load, version]);

  const incoming = people.filter((p) => p.status === 'incoming');
  const outgoing = people.filter((p) => p.status === 'outgoing');
  const talked = new Set((convos || []).map((c) => c.other_id));
  const quiet = people.filter((p) => p.status === 'friends' && !talked.has(p.id));
  const changed = () => { load(); onChanged?.(); };

  return (
    <div className="inbox">
      {incoming.length > 0 && (
        <section>
          <h2 className="inbox-head">Friend requests <span className="badge">{incoming.length}</span></h2>
          <ul className="inbox-list">
            {incoming.map((p) => (
              <li key={p.id} className="inbox-req">
                <Link to={`/people/${p.id}`} className="row"><Avatar name={p.display_name} url={p.avatar_url} />
                  <span><strong>{p.display_name}</strong>{p.area ? <><br /><span className="small muted">{p.area}</span></> : null}</span></Link>
                <FriendButton personId={p.id} name={p.display_name} status="incoming" onChange={changed} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="inbox-head">Messages</h2>
        {convos === null && <p className="muted small">Loading…</p>}
        {convos && convos.length === 0 && quiet.length === 0 && (
          <p className="muted small">No messages yet. Once someone accepts your friend request, you can message them here. <Link to="/discover">Find people on Discover</Link>.</p>
        )}
        <ul className="inbox-list">
          {(convos || []).map((c) => (
            <li key={c.other_id}>
              <Link to={`/messages/${c.other_id}`} className={`convo${activeId === c.other_id ? ' convo-on' : ''}${c.unread > 0 ? ' convo-unread' : ''}`}>
                <Avatar name={c.display_name} url={c.avatar_url} />
                <span className="convo-text">
                  <span className="row-between"><strong>{c.display_name}</strong><span className="small muted">{timeAgo(c.last_at)}</span></span>
                  <span className="small convo-last">{c.last_from_me ? 'You: ' : ''}{c.last_body}</span>
                </span>
                {c.unread > 0 && <span className="badge" aria-label={`${c.unread} unread`}>{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {quiet.length > 0 && (
        <section>
          <h2 className="inbox-head">Friends</h2>
          <ul className="inbox-list">
            {quiet.map((p) => (
              <li key={p.id}>
                <Link to={`/messages/${p.id}`} className={`convo${activeId === p.id ? ' convo-on' : ''}`}>
                  <Avatar name={p.display_name} url={p.avatar_url} />
                  <span className="convo-text"><strong>{p.display_name}</strong><span className="small muted">Say hi</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="inbox-head">Requests you sent</h2>
          <ul className="inbox-list">
            {outgoing.map((p) => (
              <li key={p.id} className="inbox-req">
                <Link to={`/people/${p.id}`} className="row"><Avatar name={p.display_name} url={p.avatar_url} /><strong>{p.display_name}</strong></Link>
                <FriendButton personId={p.id} name={p.display_name} status="outgoing" onChange={changed} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Right side: one conversation
function Thread({ otherId, onRead }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState(undefined);
  const [status, setStatus] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const lastCount = useRef(0);

  const loadMsgs = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: false }).limit(200);
    const list = (data || []).reverse();
    setMsgs(list);
    if (list.some((m) => m.recipient_id === user.id && !m.read_at)) {
      await supabase.rpc('mark_read', { p_other: otherId });
      onRead?.();
    }
  }, [otherId, user.id, onRead]);

  useEffect(() => {
    setOther(undefined); setMsgs(null); setDraft(''); setError(''); lastCount.current = 0;
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').eq('id', otherId).maybeSingle(),
        supabase.rpc('friend_status', { p_other: otherId }),
      ]);
      setOther(p ?? null); setStatus(s || 'none');
    })();
    loadMsgs();
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadMsgs(); }, POLL_MS);
    return () => clearInterval(t);
  }, [otherId, loadMsgs]);

  useEffect(() => {
    if (msgs && msgs.length !== lastCount.current) {
      endRef.current?.scrollIntoView({ block: 'end', behavior: lastCount.current ? 'smooth' : 'auto' });
      lastCount.current = msgs.length;
    }
  }, [msgs]);

  if (other === undefined) return <p className="muted pad-sm">Loading…</p>;
  if (other === null) return <p className="pad-sm">This person isn't on Out &amp; About anymore.</p>;

  const send = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true); setError('');
    const { data, error: err } = await supabase.rpc('send_message', { p_to: otherId, p_body: body });
    setSending(false);
    if (err) { setError(err.message); return; }
    setDraft('');
    setMsgs((m) => [...(m || []), data]);
  };

  const block = async () => {
    if (!window.confirm(`Block ${other.display_name}? You'll stop being friends, and neither of you can message the other.`)) return;
    await supabase.from('blocks').insert({ blocked_id: otherId });
    navigate('/messages');
  };

  const canSend = status === 'friends';

  return (
    <div className="thread">
      <header className="thread-head">
        <Link to="/messages" className="thread-back" aria-label="Back to messages">←</Link>
        <Link to={`/people/${otherId}`} className="row"><Avatar name={other.display_name} url={other.avatar_url} /><strong>{other.display_name}</strong></Link>
      </header>

      <div className="thread-body" aria-live="polite">
        {msgs === null && <p className="muted small">Loading…</p>}
        {msgs && msgs.length === 0 && canSend && <p className="muted small thread-empty">You're friends with {other.display_name}. Say hi and maybe plan to meet up at a gathering!</p>}
        {(msgs || []).map((m, i) => {
          const mine = m.sender_id === user.id;
          const prev = msgs[i - 1];
          const gap = !prev || new Date(m.created_at) - new Date(prev.created_at) > 15 * 60000;
          return (
            <div key={m.id}>
              {gap && <p className="thread-time small muted">{stamp(m.created_at)}</p>}
              <p className={`bubble${mine ? ' bubble-me' : ''}`}>{m.body}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {canSend ? (
        <form className="composer" onSubmit={send}>
          <label className="sr-only" htmlFor="composer">Message {other.display_name}</label>
          <textarea id="composer" rows={1} maxLength={2000} value={draft} placeholder={`Message ${other.display_name}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !draft.trim()}>{sending ? '…' : 'Send'}</button>
        </form>
      ) : (
        <div className="composer-off">
          <p className="small" style={{ margin: 0 }}>You can only message friends.{status === 'none' ? ` Send ${other.display_name} a friend request first.` : ''}</p>
          <FriendButton personId={otherId} name={other.display_name} status={status} onChange={setStatus} />
        </div>
      )}
      {error && <p className="error small" role="alert">{error}</p>}

      <footer className="thread-foot small">
        <span>Meeting up? Pick a public place first, and tell a friend where you'll be.</span>
        <span className="row" style={{ gap: 14 }}>
          <button type="button" className="linkish small" onClick={block}>Block</button>
          <ReportButton targetType="user" targetId={otherId} label="Report" />
        </span>
      </footer>
    </div>
  );
}

export default function MessagesPage() {
  const { id } = useParams();
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    window.dispatchEvent(new Event('oa-inbox-changed'));
  }, []);

  return (
    <div className={`pad messages${id ? ' has-thread' : ''}`}>
      <h1 className="page-title messages-title">Messages</h1>
      <div className="messages-grid">
        <aside className="messages-side"><Inbox activeId={id} version={version} onChanged={bump} /></aside>
        <section className="messages-main">
          {id ? <Thread key={id} otherId={id} onRead={bump} />
            : <div className="empty"><h3>Pick a conversation</h3><p className="small">Messages are just between you and your friends.</p></div>}
        </section>
      </div>
    </div>
  );
}
