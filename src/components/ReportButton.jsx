import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

const REASONS = ['Feels unsafe', 'Harassment or hate', 'Scam or fake event', 'Wrong or misleading details', 'Something else'];

export default function ReportButton({ targetType, targetId, label = 'Report' }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [state, setState] = useState('idle');

  if (!user) return null;
  if (state === 'sent') return <p className="small">Thanks. Our team will review this.</p>;

  const send = async () => {
    setState('sending');
    const { error } = await supabase.from('reports').insert({ target_type: targetType, target_id: targetId, reason, details });
    setState(error ? 'error' : 'sent');
  };

  if (!open) return <button type="button" className="linkish" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="report-box">
      <p className="small"><strong>If you're in danger, call 911.</strong> Reports are reviewed by people, not in real time.</p>
      <label className="field">What's wrong?
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="field">Details (optional)
        <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>
      {state === 'error' && <p className="error">The report didn't send. Check your connection and try again.</p>}
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={send} disabled={state === 'sending'}>Send report</button>
        <button type="button" className="linkish" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
