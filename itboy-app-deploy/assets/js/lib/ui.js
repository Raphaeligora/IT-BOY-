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

  // Etat de chargement générique — évite un écran blanc le temps que
  // Supabase réponde. A appeler juste avant les premiers await d'un
  // init(), le rendu final remplacera ce placeholder via innerHTML.
  function showLoading(container, label) {
    container.innerHTML = '<p class="loading-state">' + escapeHtml(label || 'Chargement…') + '</p>';
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
  // Liens en racine absolue (/dashboard/, /stats/) plutôt que relatifs :
  // ce même markup est injecté depuis des pages a des profondeurs
  // differentes (/dashboard/, /habits/, /stats/combined/...) ou "../"
  // ne pointerait pas toujours au meme endroit.
  function renderNav(active) {
    return '<nav class="app-nav"><div class="app-nav-inner">' +
      '<a href="/dashboard/" class="logo-mark" style="font-size:19px"><span class="i">I</span><span class="b">B</span></a>' +
      '<div class="app-nav-tabs">' +
      '<a href="/dashboard/" class="app-nav-tab' + (active === 'dashboard' ? ' active' : '') + '">Tableau de bord</a>' +
      '<a href="/stats/" class="app-nav-tab' + (active === 'stats' ? ' active' : '') + '">Statistiques</a>' +
      '</div>' +
      '<button class="link-muted app-nav-logout" id="logout-btn" type="button">Se déconnecter</button>' +
      '</div></nav>';
  }

  // Toasts — petites notifications ephemeres en bas d'ecran, injectees
  // au premier appel (pas besoin d'un element dedie dans chaque page
  // HTML). Utilise pour la celebration (streaks/journee complete) et
  // pour "Annuler" apres un archivage.
  function ensureToastRoot() {
    var root = document.getElementById('itboy-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'itboy-toast-root';
      root.className = 'toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function showToast(message, opts) {
    opts = opts || {};
    var root = ensureToastRoot();
    var toast = document.createElement('div');
    toast.className = 'toast' + (opts.variant ? ' toast-' + opts.variant : '');

    var msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    toast.appendChild(msg);

    var timeoutId;
    function dismiss() {
      clearTimeout(timeoutId);
      toast.classList.add('toast-leaving');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
    }

    if (opts.actionLabel && opts.onAction) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', function () {
        opts.onAction();
        dismiss();
      });
      toast.appendChild(btn);
    }

    root.appendChild(toast);
    timeoutId = setTimeout(dismiss, opts.duration || 4000);
    return { dismiss: dismiss };
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
    showLoading: showLoading,
    showToast: showToast,
    escapeHtml: escapeHtml,
    renderNav: renderNav,
    mountNav: mountNav
  };
})(window);
