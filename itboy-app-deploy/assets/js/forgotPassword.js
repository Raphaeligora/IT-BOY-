/* IT BOY — Écran /forgot-password
   Envoie un email de réinitialisation via Supabase Auth. Ne révèle
   jamais si l'email existe ou non (message générique), pour éviter
   d'exposer la liste des comptes inscrits. */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var form = document.getElementById('forgot-form');
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

    try {
      await window.ITBOY.auth.resetPasswordForEmail(email);
    } catch (err) {
      // On affiche quand même le message générique de succès : une erreur
      // ici (ex. email inconnu) ne doit pas permettre de deviner quels
      // comptes existent.
    }

    bannerZone.innerHTML =
      '<div class="banner-info">Si un compte existe pour cet email, un lien de réinitialisation vient d\'être envoyé. Vérifie ta boîte mail (et les spams).</div>';
    form.style.display = 'none';
  });
})();
