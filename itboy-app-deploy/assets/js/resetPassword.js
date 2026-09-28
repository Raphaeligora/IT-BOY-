/* IT BOY — Écran /reset-password
   Arrivée depuis le lien reçu par email (voir forgotPassword.js). Le SDK
   Supabase lit automatiquement les jetons dans le hash de l'URL au
   chargement de la page et établit une session de type "recovery" ; on
   attend l'événement PASSWORD_RECOVERY avant d'autoriser la saisie du
   nouveau mot de passe. */

(function () {
  var subtitleEl = document.getElementById('page-subtitle');
  var bannerZone = document.getElementById('banner-zone');
  var form = document.getElementById('reset-form');
  var submitBtn = document.getElementById('submit-btn');

  if (!window.ITBOY.isSupabaseConfigured) {
    window.ITBOY.ui.showConfigBanner(bannerZone);
    subtitleEl.textContent = '';
    return;
  }

  var ready = false;

  function showForm() {
    if (ready) return;
    ready = true;
    subtitleEl.textContent = 'Choisis un nouveau mot de passe.';
    form.style.display = 'flex';
  }

  // Cas normal : le SDK détecte le lien de récupération dans l'URL et
  // déclenche cet événement (généralement en quelques centaines de ms).
  window.ITBOY.supabase.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') showForm();
  });

  // Filet de sécurité : si une session existe déjà au chargement (l'event
  // ci-dessus a pu se déclencher avant l'ajout du listener), on l'accepte
  // aussi plutôt que de laisser l'utilisateur bloqué sur "Vérification...".
  window.ITBOY.supabase.auth.getSession().then(function (res) {
    if (res && res.data && res.data.session) showForm();
  });

  // Si après quelques secondes rien ne s'est passé, le lien est probablement
  // invalide ou expiré (Supabase : 1h de validité).
  setTimeout(function () {
    if (!ready) {
      subtitleEl.textContent = '';
      bannerZone.innerHTML =
        '<div class="banner-error">Ce lien est invalide ou a expiré. ' +
        '<a href="../forgot-password/">Demande-en un nouveau</a>.</div>';
    }
  }, 5000);

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    bannerZone.innerHTML = '';

    var password = form.password.value;
    var passwordConfirm = form.passwordConfirm.value;

    if (password !== passwordConfirm) {
      bannerZone.innerHTML = '<div class="banner-error">Les deux mots de passe ne correspondent pas.</div>';
      return;
    }

    submitBtn.disabled = true;

    try {
      await window.ITBOY.auth.updatePassword(password);
      bannerZone.innerHTML = '<div class="banner-info">Mot de passe mis à jour. Redirection...</div>';
      form.style.display = 'none';
      setTimeout(function () { window.location.href = '../dashboard/'; }, 1200);
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
      submitBtn.disabled = false;
    }
  });
})();
