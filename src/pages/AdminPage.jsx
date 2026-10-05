import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import NewMembers from '../components/NewMembers.jsx';

const URGENT = ['Feels unsafe', 'Harassment or hate'];
const TYPE_LABEL = { event: 'Gathering', user: 'Person', post: 'Circle post', circle: 'Circle', review: 'Review' };
const FILTERS = [['open', 'Open'], ['reviewing', 'Reviewing'], ['closed', 'Closed'], ['all', 'All']];

function storagePath(url) {
  const marker = '/avatars/';
  const i = url ? url.indexOf(marker) : -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

function targetLink(r) {
  if (r.target_type === 'event' && r.target_label) return `/events/${r.target_id}`;
  if (r.target_type === 'circle' && r.target_label) return `/circles/${r.target_id}`;
  if (r.target_type === 'review' && r.target_event_id) return `/events/${r.target_event_id}`;
  if (r.target_person_id) return `/people/${r.target_person_id}`;
  return null;
}

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [filter, setFilter] = useState('open');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('admin_reports', { p_status: filter });
    if (err) { setError(err.message); setRows([]); return; }
    setError(''); setRows(data || []);
  }, [filter]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (loading) return <p className="pad muted">Loading…</p>;
  if (!isAdmin) return <div className="pad narrow"><h1 className="page-title">Not found</h1><p><Link to="/">Back to Explore</Link></p></div>;

  // Runs an admin action, shows what happened, then refreshes the list
  const act = async (key, confirmText, fn, done) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setMsg(''); setError('');
    try {
      const { error: err } = await fn();
      if (err) throw err;
      setMsg(done);
      await load();
    } catch (err) { setError(err.message || String(err)); }
    setBusy(null);
  };

  const setStatus = (r, status) => act(`${r.id}:status`, null,
    () => supabase.rpc('admin_set_report_status', { p_report: r.id, p_status: status }),
    status === 'closed' ? 'Report closed.' : `Marked ${status}.`);

  const removeEvent = (r) => act(`${r.id}:event`, `Remove "${r.target_label}"? Guests get a cancellation email. This can't be undone.`,
    () => supabase.rpc('admin_remove_event', { p_event: r.target_id }), 'Gathering removed and guests notified.');

  const removePost = (r) => act(`${r.id}:post`, 'Delete this circle post? This can\'t be undone.',
    () => supabase.rpc('admin_remove_post', { p_post: r.target_id }), 'Post removed.');

  const removeReview = (r) => act(`${r.id}:review`, 'Delete this review? This can\'t be undone.',
    () => supabase.rpc('admin_remove_review', { p_review: r.target_id }), 'Review removed.');

  const removePhoto = (r) => act(`${r.id}:photo`, `Remove ${r.target_person_name}'s profile photo?`,
    async () => {
      const res = await supabase.rpc('admin_clear_photo', { p_user: r.target_person_id });
      const path = storagePath(res.data);
      if (!res.error && path) await supabase.storage.from('avatars').remove([path]);
      return res;
    }, 'Photo removed.');

  const verify = (r, on) => act(`${r.id}:verify`, null,
    () => supabase.rpc('admin_set_verified', { p_user: r.target_person_id, p_verified: on }), on ? 'Marked verified.' : 'Verification removed.');

  const removePerson = (r) => {
    const name = r.target_person_name || 'this person';
    const typed = window.prompt(`Remove ${name} from Out & About?\n\nThis deletes their account, profile, photo, gatherings, RSVPs, posts, and reviews, and stops their email from signing up again. It can't be undone.\n\nType REMOVE to confirm.`);
    if (typed !== 'REMOVE') return;
    act(`${r.id}:person`, null, async () => {
      const res = await supabase.rpc('admin_clear_photo', { p_user: r.target_person_id });
      const path = storagePath(res.data);
      if (path) await supabase.storage.from('avatars').remove([path]);
      return supabase.rpc('admin_remove_person', { p_user: r.target_person_id, p_ban: true, p_reason: `${r.reason}${r.details ? `: ${r.details}` : ''}` });
    }, `${name} was removed and can't sign up again with that email.`);
  };

  const openCount = rows ? rows.filter((r) => r.status === 'open').length : 0;

  return (
    <div className="pad admin">
      <div className="row-between"><h1 className="page-title">Admin</h1>
        <button type="button" className="btn btn-sm" onClick={load}>Refresh</button></div>
      <NewMembers />

      <h2 style={{ marginTop: 24 }}>Reports</h2>
      <p className="small muted">Urgent safety reports should be handled within an hour. You get an email for every new report.</p>

      <div className="chips" role="tablist" aria-label="Filter reports" style={{ margin: '12px 0' }}>
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key}
            className={`chip${filter === key ? ' chip-on' : ''}`} onClick={() => setFilter(key)}>
            {label}{key === 'open' && filter === 'open' && rows ? ` (${openCount})` : ''}
          </button>
        ))}
      </div>

      {msg && <p className="panel panel-safe" role="status" style={{ margin: '0 0 12px' }}>{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {rows === null && <p className="muted">Loading reports…</p>}
      {rows && rows.length === 0 && <div className="empty"><h3>Nothing here</h3><p>No {filter === 'all' ? '' : filter} reports right now.</p></div>}

      <ul className="report-list">
        {(rows || []).map((r) => {
          const urgent = URGENT.includes(r.reason) && r.status !== 'closed';
          const link = targetLink(r);
          const gone = !r.target_label && r.target_type !== 'user';
          const b = (k) => busy === `${r.id}:${k}`;
          return (
            <li key={r.id} className={`report-card${urgent ? ' urgent' : ''}${r.status === 'closed' ? ' closed' : ''}`}>
              <div className="row-between">
                <span className="row" style={{ gap: 8 }}>
                  {urgent && <span className="pill pill-dark">Urgent</span>}
                  <span className="pill">{TYPE_LABEL[r.target_type] || r.target_type}</span>
                  <strong>{r.reason}</strong>
                </span>
                <span className="small muted">{timeAgo(r.created_at)} ago · {r.status}</span>
              </div>

              <div className="report-target">
                {r.target_person_id && <Avatar name={r.target_person_name} url={r.target_avatar_url} />}
                <div style={{ minWidth: 0 }}>
                  {gone
                    ? <p className="muted" style={{ margin: 0 }}>This {TYPE_LABEL[r.target_type]?.toLowerCase()} was already removed.</p>
                    : <p style={{ margin: 0 }}>{link ? <Link to={link}><strong>{r.target_label || r.target_person_name}</strong></Link> : <strong>{r.target_label}</strong>}</p>}
                  {r.target_person_name && r.target_type !== 'user' && (
                    <p className="small" style={{ margin: 0 }}>By <Link to={`/people/${r.target_person_id}`}>{r.target_person_name}</Link></p>
                  )}
                  {r.open_reports_on_person > 1 && <p className="small error" style={{ margin: 0 }}>{r.open_reports_on_person} open reports involve this person</p>}
                </div>
              </div>

              {r.details && <blockquote className="report-details">{r.details}</blockquote>}
              <p className="small muted" style={{ margin: 0 }}>Reported by {r.reporter_name ? <Link to={`/people/${r.reporter_id}`}>{r.reporter_name}</Link> : 'a member who has since left'}</p>

              <div className="admin-actions">
                {r.status !== 'reviewing' && r.status !== 'closed' && <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => setStatus(r, 'reviewing')}>Mark reviewing</button>}
                {r.status !== 'closed'
                  ? <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => setStatus(r, 'closed')}>{b('status') ? '…' : 'Close (no action)'}</button>
                  : <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => setStatus(r, 'open')}>Reopen</button>}
                {r.target_type === 'event' && !gone && <button type="button" className="btn btn-sm btn-danger" disabled={!!busy} onClick={() => removeEvent(r)}>{b('event') ? 'Removing…' : 'Remove gathering'}</button>}
                {r.target_type === 'post' && !gone && <button type="button" className="btn btn-sm btn-danger" disabled={!!busy} onClick={() => removePost(r)}>{b('post') ? 'Removing…' : 'Remove post'}</button>}
                {r.target_type === 'review' && !gone && <button type="button" className="btn btn-sm btn-danger" disabled={!!busy} onClick={() => removeReview(r)}>{b('review') ? 'Removing…' : 'Remove review'}</button>}
                {r.target_person_id && r.target_avatar_url && <button type="button" className="btn btn-sm btn-danger" disabled={!!busy} onClick={() => removePhoto(r)}>{b('photo') ? 'Removing…' : 'Remove photo'}</button>}
                {r.target_person_id && <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => verify(r, true)}>Verify person</button>}
                {r.target_person_id && <button type="button" className="btn btn-sm btn-danger-solid" disabled={!!busy} onClick={() => removePerson(r)}>{b('person') ? 'Removing…' : 'Remove & ban person'}</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
