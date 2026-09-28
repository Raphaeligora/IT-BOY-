/* IT BOY — Tracking d'événements produit (table `events`, voir
   supabase/schema.sql section 7b). Écriture seule, best-effort : un
   échec (offline, config absente, RLS...) ne doit jamais casser un
   parcours utilisateur, donc chaque appel avale ses propres erreurs.

   anon_id : identifiant anonyme persistant en localStorage, pour
   relier les événements d'un même visiteur avant qu'il ait un compte
   (clic CTA landing -> signup -> premier habitude -> plan choisi).
   Pas un identifiant de session applicatif (contrairement à l'ancien
   quiz_session id) : sert uniquement à l'analyse, jamais lu par le reste
   de l'app. */

(function (global) {
  var ANON_ID_KEY = 'itboy_anon_id';

  function getAnonId() {
    try {
      var id = localStorage.getItem(ANON_ID_KEY);
      if (!id) {
        id = (global.crypto && global.crypto.randomUUID)
          ? global.crypto.randomUUID()
          : (String(Date.now()) + Math.random().toString(16).slice(2));
        localStorage.setItem(ANON_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  // track(name, meta?, userId?) — ne jamais attendre (await) cet appel
  // avant une navigation : il ne doit jamais retarder le parcours.
  async function track(name, meta, userId) {
    if (!global.ITBOY || !global.ITBOY.isSupabaseConfigured || !global.ITBOY.supabase) return;
    try {
      var row = { name: name, meta: meta || {}, anon_id: getAnonId() };
      if (userId) row.user_id = userId;
      await global.ITBOY.supabase.from('events').insert(row);
    } catch (e) {
      console.warn('[itboy] echec du tracking "' + name + '" :', e);
    }
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.track = track;
})(window);
