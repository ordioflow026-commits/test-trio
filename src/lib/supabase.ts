import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xxyfklfyzegnuyvncyqt.supabase.co/rest/v1/';
const supabaseKey = 'sb_publishable_LvGmrUhoevb83MXKV5WgPA_76FPlA4B';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
  }
});
