import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from './supabase.js';

// Unread messages + pending friend requests, for the badge in the top bar
export default function useInboxCounts(userId, hasProfile) {
  const { pathname } = useLocation();
  const [counts, setCounts] = useState({ messages: 0, requests: 0 });

  useEffect(() => {
    if (!userId || !hasProfile) { setCounts({ messages: 0, requests: 0 }); return undefined; }
    let live = true;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      const { data } = await supabase.rpc('my_inbox_counts');
      const row = data?.[0];
      if (live && row) setCounts({ messages: Number(row.unread_messages) || 0, requests: Number(row.friend_requests) || 0 });
    };
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('oa-inbox-changed', load);
    document.addEventListener('visibilitychange', load);
    return () => { live = false; clearInterval(t); window.removeEventListener('oa-inbox-changed', load); document.removeEventListener('visibilitychange', load); };
  }, [userId, hasProfile, pathname]);

  return counts;
}
