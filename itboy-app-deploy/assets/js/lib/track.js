/* IT BOY — Tracking d'événements produit (table `events`, voir
   supabase/schema.sql section 7b). Écriture seule, best-effort : un
   échec (offline, config absente, RLS...) ne doit jamais casser un
   parcours utilisateur, donc chaque appel avale ses propres erreurs.

   anon_id : identifiant anonyme persistant en localStorage, pour
   relier les événements d'un même visiteur avant qu'il ait un compte
   (clic CTA landing -> signup -> premier habitude -> plan choisi).
   Pas un identifiant de session applicatif (contrairement à l'ancien
   quiz_session id) : sert uniquement à l'analyse, jamais lu par le reste
   de l'app.

   Exclusion du proprietaire : cet outil mesure les VISITEURS/UTILISATEURS,
   pas mon propre usage du produit en le testant/utilisant au quotidien.
   Des qu'une session connectee avec le compte proprietaire est detectee,
   ce navigateur est marque (localStorage) et n'est plus jamais tracke,
   meme en navigation deconnectee ensuite (landing page, etc). */

(function (global) {
  var ANON_ID_KEY = 'itboy_anon_id';
  var OWNER_DEVICE_KEY = 'itboy_owner_device';
  var OWNER_EMAIL = 'raphaeligora@gmail.com';

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

  function isOwnerDevice() {
    try { return localStorage.getItem(OWNER_DEVICE_KEY) === '1'; } catch (e) { return false; }
  }

  function markOwnerDevice() {
    try { localStorage.setItem(OWNER_DEVICE_KEY, '1'); } catch (e) { /* ignore */ }
  }

  // track(name, meta?, userId?) — ne jamais attendre (await) cet appel
  // avant une navigation : il ne doit jamais retarder le parcours.
  async function track(name, meta, userId) {
    if (!global.ITBOY || !global.ITBOY.isSupabaseConfigured || !global.ITBOY.supabase) return;
    if (isOwnerDevice()) return; // proprietaire : jamais compte dans les stats
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

  // ---- page_view automatique ----------------------------------------
  // Une fois par chargement de page, sur toute page qui inclut track.js
  // (voir index.html/dashboard/login/... : <script src=".../track.js">).
  // best-effort, jamais bloquant. user_id recupere de facon async via
  // getSession() (deja en cache localement par supabase-js, donc rapide
  // et sans requete reseau) pour relier les vues aux comptes connectes
  // sans dupliquer la logique auth de chaque page. C'est aussi ici que
  // le compte proprietaire est detecte (voir markOwnerDevice ci-dessus).
  function trackPageView() {
    if (!global.ITBOY || !global.ITBOY.isSupabaseConfigured || !global.ITBOY.supabase) return;
    if (isOwnerDevice()) return;
    var meta = { path: global.location.pathname, referrer: document.referrer || null };
    global.ITBOY.supabase.auth.getSession().then(function (res) {
      var sessionUser = res && res.data && res.data.session && res.data.session.user;
      if (sessionUser && (sessionUser.email || '').toLowerCase() === OWNER_EMAIL) {
        markOwnerDevice();
        return; // ne compte pas non plus cette vue-la
      }
      track('page_view', meta, sessionUser ? sessionUser.id : null);
    }).catch(function () { track('page_view', meta); });
  }

  // ---- clics génériques via data-track ------------------------------
  // Marquer un élément cliquable avec data-track="nom_evenement" (et
  // optionnellement data-track-meta='{"cle":"valeur"}' en JSON) suffit
  // à le faire remonter dans le dashboard interne, sans code JS dédié
  // par bouton. Un seul écouteur délégué sur tout le document.
  function initClickTracking() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-track]');
      if (!el) return;
      var name = el.getAttribute('data-track');
      var meta = { path: global.location.pathname };
      var metaAttr = el.getAttribute('data-track-meta');
      if (metaAttr) {
        try { Object.assign(meta, JSON.parse(metaAttr)); } catch (e2) { /* ignore JSON invalide */ }
      }
      track(name, meta);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { trackPageView(); initClickTracking(); });
  } else {
    trackPageView();
    initClickTracking();
  }
})(window);
