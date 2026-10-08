(function () {
  async function getMyProfile(userId) {
    if (!window.hpSupabase) throw new Error('Supabase is not configured.');
    try {
      const { data, error } = await window.hpSupabase
        .from('profiles')
        .select('id, username, full_name, mobile, role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error('Profile lookup failed.', { cause: error });
    }
  }

  window.HappynessAPI = Object.freeze({
    isConfigured: () => Boolean(window.hpSupabase),
    getMyProfile
  });
})();
