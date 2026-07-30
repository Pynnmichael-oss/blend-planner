// Supabase client for saving plans to the shared blend_plans table that
// the Blend Case Manager (terminal-blending-dashboard) reads from.
//
// Vite exposes env vars prefixed VITE_ via import.meta.env at build time.
// Set these in a local .env.local (gitignored) -- see .env.example.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    '[supabaseClient] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env.local and fill in your project values.'
  );
}

// Only the anon/publishable key is ever used here -- this is a
// browser-only, no-backend app. The service-role key must never be
// referenced in this project.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
