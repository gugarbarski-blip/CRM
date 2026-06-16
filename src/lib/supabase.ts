import { createClient } from '@supabase/supabase-js';

// Falls back to the project defaults so the app works without extra setup.
// The publishable (anon) key is safe to expose in client-side code; data is
// protected by Row Level Security policies on the database.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vvkcqvzcdiamdwwfaxmf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iTKUZm9mdGxIIxnsURaWtw_R_u4sTRT';

export const supabase = createClient(supabaseUrl, supabaseKey);
