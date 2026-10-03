import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

// Upcoming events plus the set of events the current user is going to.
export default function useEvents(filter = {}) {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [goingIds, setGoingIds] = useState(new Set());
  const [error, setError] = useState(null);
  const audience = filter.audience;

  useEffect(() => {
    let live = true;
    (async () => {
      const since = new Date(Date.now() - 3 * 3600000).toISOString();
      let q = supabase.from('events')
        .select('*, host:profiles!events_host_id_fkey(display_name, verified)')
        .gte('starts_at', since)
        .order('starts_at', { ascending: true })
        .limit(300);
      if (audience) q = q.eq('audience', audience);
      const { data, error: err } = await q;
      if (!live) return;
      if (err) { setError(err.message); setEvents([]); return; }
      setEvents(data);
      if (user) {
        const { data: mine } = await supabase.from('rsvps').select('event_id').eq('user_id', user.id);
        if (live) setGoingIds(new Set((mine || []).map((r) => r.event_id)));
      }
    })();
    return () => { live = false; };
  }, [user, audience]);

  return { events, goingIds, error };
}
