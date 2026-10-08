(function () {
  const config = window.HAPPINESS_SUPABASE_CONFIG;
  const isConfigured = config &&
    /^https:\/\/.+\.supabase\.co$/.test(config.SUPABASE_URL) &&
    config.SUPABASE_ANON_KEY &&
    config.SUPABASE_ANON_KEY !== 'PASTE_SUPABASE_ANON_KEY_HERE';

  window.hpSupabase = isConfigured && window.supabase?.createClient
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;
})();
