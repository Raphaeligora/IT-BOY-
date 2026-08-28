/* IT BOY — Écran /login */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var form = document.getElementById('login-form');
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
      await window.ITBOY.auth.signIn(email, password);
      window.location.href = '../dashboard/';
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
      submitBtn.disabled = false;
    }
  });
})();
