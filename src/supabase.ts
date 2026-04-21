import { createClient } from '@supabase/supabase-js';

// استبدل الروابط أدناه بالروابط التي نسختها من إعدادات Supabase الخاصة بك
const supabaseUrl = 'https://ayritytanhuieybwffgo.supabase.co';
const supabaseAnonKey = 'sb_publishable_HweMDY4RnKgM-6Z4ni7B5w_tYiev0IW';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
