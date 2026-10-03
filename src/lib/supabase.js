import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// PKCE puts the sign-in code in the query string (?code=...), which keeps it
// separate from the hash-based page routes (#/explore).
export const supabase = isConfigured
  ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })
  : null;
