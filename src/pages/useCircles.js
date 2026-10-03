import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { circleLevel } from '../lib/constants.js';

export default function useCircles(audience) {
  const { user } = useAuth();
  const [circles, setCircles] = useState(null);

  const load = useCallback(async () => {
    let q = supabase.from('circles').select('*').order('created_at', { ascending: false });
    if (audience) q = q.eq('audience', audience);
    const [{ data: rows }, { data: counts }, mine] = await Promise.all([
      q,
      supabase.rpc('circle_counts'),
      user ? supabase.from('circle_members').select('circle_id').eq('user_id', user.id) : Promise.resolve({ data: [] }),
    ]);
    const countMap = new Map((counts || []).map((c) => [c.circle_id, Number(c.members)]));
    const mineSet = new Set((mine.data || []).map((m) => m.circle_id));
    setCircles((rows || []).map((c) => {
      const members = countMap.get(c.id) || 0;
      return { ...c, members, level: circleLevel(members), joined: mineSet.has(c.id) };
    }));
  }, [audience, user]);

  useEffect(() => { load(); }, [load]);

  const toggleJoin = async (c) => {
    if (c.joined) await supabase.from('circle_members').delete().eq('circle_id', c.id).eq('user_id', user.id);
    else await supabase.from('circle_members').insert({ circle_id: c.id });
    load();
  };

  return { circles, reload: load, toggleJoin };
}
