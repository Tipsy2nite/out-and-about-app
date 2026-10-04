import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Star averages for a list of host ids → { [hostId]: { avg_rating, review_count } }
export default function useHostRatings(hostIds) {
  const [ratings, setRatings] = useState({});
  const key = [...new Set((hostIds || []).filter(Boolean))].sort().join(',');

  useEffect(() => {
    if (!key) { setRatings({}); return undefined; }
    let live = true;
    supabase.rpc('host_ratings', { hids: key.split(',') }).then(({ data }) => {
      if (!live) return;
      const map = {};
      (data || []).forEach((r) => { map[r.host_id] = r; });
      setRatings(map);
    });
    return () => { live = false; };
  }, [key]);

  return ratings;
}
