import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oifkggobiqixdarqlaiw.supabase.co'
const supabaseAnonKey = 'PASTE_YOUR_PUBLISHABLE_KEY_HERE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
