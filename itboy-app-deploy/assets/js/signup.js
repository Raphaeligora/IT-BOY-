/* IT BOY — Écran /signup
   Crée le compte (Supabase Auth), relie la quiz_session en cours au
   nouvel utilisateur, puis redirige vers /plans. La ligne `profiles`
   (plan='free') est créée automatiquement en base par un trigger
   (voir supabase/schema.sql) — pas de logique à dupliquer ici. */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var form = document.getElementById('signup-form');
  var submitBtn = document.getElementById('submit-btn');

  if (!window.ITBOY.isSupabaseConfigured) {
    window.ITBOY.ui.showConfigBanner(bannerZone);
    submitBtn.disabled = true;
    return;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    bannerZone.innerHTML = '';
    submitBtn.disabled = true;

    var email = form.email.value.trim();
    var password = form.password.value;

    try {
      var result = await window.ITBOY.auth.signUp(email, password);
      var user = result.user;

      if (user && result.session) {
        var sessionId = window.ITBOY.storage.getSessionId();
        if (sessionId) {
          try { await window.ITBOY.api.linkQuizSessionToUser(sessionId, user.id); }
          catch (linkErr) { console.warn('[itboy] échec du rattachement de la quiz_session :', linkErr); }
        }
        window.location.href = '../plans/';
        return;
      }

      // Confirmation email activée sur le projet Supabase : pas de
      // session immédiate, on ne peut pas encore rattacher la quiz_session
      // ni rediriger vers une page protégée.
      bannerZone.innerHTML = '<div class="banner-info">Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis <a href="../login/">connecte-toi</a>.</div>';
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
      submitBtn.disabled = false;
    }
  });
})();
