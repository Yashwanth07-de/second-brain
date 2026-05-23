/* ═══════════════════════════════════════════
   supabase.js — hosted backend client
═══════════════════════════════════════════ */

const SUPABASE_URL = 'https://felkriczzivosmpbehgb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlbGtyaWN6eml2b3NtcGJlaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTU3MTgsImV4cCI6MjA5NTA5MTcxOH0.evIuiENA0hWbzG-jaanYPtkILD9hfUGjn0iPntZo41g';

const SupabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

window.SB = {
  url: SUPABASE_URL,
  client: SupabaseClient,
};
