/* IT BOY — Petits utilitaires d'affichage partagés entre les pages
   qui dépendent de Supabase (signup, login, plans, dashboard, habits). */

(function (global) {
  function showConfigBanner(container) {
    container.innerHTML =
      '<div class="banner-warning">' +
      'Configuration Supabase manquante. Renseigne <code>assets/js/lib/config.js</code> ' +
      'et exécute <code>supabase/schema.sql</code> dans ton projet Supabase (voir README).' +
      '</div>';
  }

  function showError(container, err) {
    var message = (err && err.message) ? err.message : String(err);
    container.innerHTML = '<div class="banner-error">' + escapeHtml(message) + '</div>';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Barre de nav partagée (dashboard, détail d'habitude, statistiques) —
  // un seul point de vérité pour les onglets et le bouton déconnexion,
  // plutôt que dupliquer le markup dans chaque page HTML statique.
  function renderNav(active) {
    return '<nav class="app-nav"><div class="app-nav-inner">' +
      '<a href="../dashboard/" class="logo-mark" style="font-size:19px"><span class="i">I</span><span class="b">B</span></a>' +
      '<div class="app-nav-tabs">' +
      '<a href="../dashboard/" class="app-nav-tab' + (active === 'dashboard' ? ' active' : '') + '">Tableau de bord</a>' +
      '<a href="../stats/" class="app-nav-tab' + (active === 'stats' ? ' active' : '') + '">Statistiques</a>' +
      '</div>' +
      '<button class="link-muted app-nav-logout" id="logout-btn" type="button">Se déconnecter</button>' +
      '</div></nav>';
  }

  function mountNav(active) {
    var mount = document.getElementById('nav-mount');
    if (!mount) return;
    mount.innerHTML = renderNav(active);
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () { window.ITBOY.auth.signOut(); });
    }
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.ui = {
    showConfigBanner: showConfigBanner,
    showError: showError,
    escapeHtml: escapeHtml,
    renderNav: renderNav,
    mountNav: mountNav
  };
})(window);
