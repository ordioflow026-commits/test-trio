import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ayritytanhuieybwffgo.supabase.co', 'sb_publishable_HweMDY4RnKgM-6Z4ni7B5w_tYiev0IW');
async function check() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles DATA:', data, 'ERROR:', error?.message);
}
check();
