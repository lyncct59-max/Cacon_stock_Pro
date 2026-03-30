window.SUPABASE_URL = "https://unlrlmxlngxhstbnrzax.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_DB9DIVS7RWnE4rEfY4GaHg_Kwc8rhya";
window.supabaseClient = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;
