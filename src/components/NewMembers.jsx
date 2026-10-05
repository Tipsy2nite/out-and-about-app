import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { timeAgo } from '../lib/format.js';
import Avatar from './Avatar.jsx';

// Admin page: who joined lately, plus the "email me when someone joins" switch.
export default function NewMembers() {
  const [rows, setRows] = useState(null);
  const [notify, setNotify] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [{ data, error: err }, { data: on }] = await Promise.all([
      supabase.rpc('admin_recent_members', { p_limit: 25 }),
      supabase.rpc('admin_new_member_emails'),
    ]);
    if (err) { setError(err.message); setRows([]); return; }
    setError(''); setRows(data || []); setNotify(on !== false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (e) => {
    const on = e.target.checked;
    setNotify(on);
    const { error: err } = await supabase.rpc('admin_set_new_member_emails', { p_on: on });
    if (err) { setNotify(!on); setError(err.message); }
  };

  const total = rows?.[0]?.total ?? 0;
  const week = rows?.[0]?.last_7_days ?? 0;
  const shown = open ? rows || [] : (rows || []).slice(0, 5);

  return (
    <section className="panel new-members" aria-label="New members">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>New members</h2>
        {rows && <span className="small"><strong>{total}</strong> members · <strong>{week}</strong> joined this week</span>}
      </div>
      <label className="row small" style={{ gap: 8, margin: '10px 0' }}>
        <input type="checkbox" checked={Boolean(notify)} disabled={notify === null} onChange={toggle} />
        Email me when someone new joins
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {rows === null && <p className="muted small">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted small">No members yet.</p>}
      <ul className="member-list">
        {shown.map((m) => (
          <li key={m.id}>
            <Avatar name={m.display_name} url={m.avatar_url} />
            <span style={{ minWidth: 0 }}>
              <Link to={`/people/${m.id}`}><strong>{m.display_name}</strong></Link>
              {m.neighborhood ? <span className="small muted"> · {m.neighborhood}</span> : null}
              <br /><span className="small muted">{m.email} · joined {timeAgo(m.joined_at)} ago</span>
            </span>
          </li>
        ))}
      </ul>
      {rows && rows.length > 5 && (
        <button type="button" className="linkish small" onClick={() => setOpen(!open)}>{open ? 'Show fewer' : `Show ${rows.length - 5} more`}</button>
      )}
    </section>
  );
}
