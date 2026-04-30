import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ayritytanhuieybwffgo.supabase.co';
const supabaseKey = 'sb_publishable_HweMDY4RnKgM-6Z4ni7B5w_tYiev0IW';

export const supabase = createClient(supabaseUrl, supabaseKey);
