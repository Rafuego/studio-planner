// ============================================================
// SUPABASE CONFIGURATION
// Replace these with your Supabase project credentials.
// Find them at: https://supabase.com/dashboard → Project Settings → API
// ============================================================

const SUPABASE_URL = 'https://xxeqirvewxkhjzapmgzx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZXFpcnZld3hraGp6YXBtZ3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDgzMTIsImV4cCI6MjA4NjgyNDMxMn0.IpPwua9_412aTIU1bFEa16v_4Jn46ruzIRORIeXm-4c';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
