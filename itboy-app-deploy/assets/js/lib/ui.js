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

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.ui = {
    showConfigBanner: showConfigBanner,
    showError: showError,
    escapeHtml: escapeHtml
  };
})(window);
