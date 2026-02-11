import { createClient } from '@supabase/supabase-js';


const supabaseUrl = `https://vobkuomsqjjanfvndttd.supabase.co`;

const supabaseKey = 'sb_publishable_P7kPmRW5RqnOb6wJBMK23w_Oy12k2Fr';

export const supabase = createClient(supabaseUrl, supabaseKey);