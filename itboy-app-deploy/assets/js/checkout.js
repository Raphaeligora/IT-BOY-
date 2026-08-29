/* IT BOY — Écran /checkout
   Demarre une session Stripe Checkout pour le plan Premium et redirige
   l'utilisateur. Ne stocke ni ne manipule aucune information de paiement
   ici — tout se passe cote Stripe. */

(function () {
  var statusEl = document.getElementById('checkout-status');
  var bannerZone = document.getElementById('banner-zone');

  function fail(message) {
    statusEl.textContent = "Le paiement n'a pas pu demarrer.";
    bannerZone.innerHTML = '<div class="banner-error">' + window.ITBOY.ui.escapeHtml(message) + '</div>';
  }

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      statusEl.textContent = '';
      return;
    }

    var user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    try {
      var sessionRes = await window.ITBOY.supabase.auth.getSession();
      var accessToken = sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.access_token;
      if (!accessToken) {
        fail('Session expiree, reconnecte-toi puis reessaie.');
        return;
      }

      var res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        }
      });

      var body = await res.json().catch(function () { return {}; });

      if (!res.ok || !body.url) {
        fail(body.error || 'Erreur inattendue, reessaie dans un instant.');
        return;
      }

      window.location.href = body.url;
    } catch (e) {
      fail(e && e.message ? e.message : String(e));
    }
  }

  init();
})();
