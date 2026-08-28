/* IT BOY — Client Supabase partagé
   Suppose que le SDK UMD Supabase est chargé avant ce script :
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   Si la config n'a pas été remplie (voir config.js), ITBOY.supabase reste
   `null` et ITBOY.isSupabaseConfigured est `false` — les pages doivent
   vérifier ce flag et afficher un message plutôt que de planter. */

(function (global) {
  var cfg = global.ITBOY_CONFIG || {};
  var isConfigured = !!(
    cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf('REPLACE_WITH') === -1 &&
    cfg.SUPABASE_ANON_KEY.indexOf('REPLACE_WITH') === -1
  );

  var client = null;
  if (isConfigured && global.supabase && typeof global.supabase.createClient === 'function') {
    client = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.supabase = client;
  global.ITBOY.isSupabaseConfigured = isConfigured;
})(window);
