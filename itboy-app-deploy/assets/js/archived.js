/* IT BOY — Écran /archived (habitudes archivées, manuellement ou via le
   downgrade Premium->Free, cf. enforce_plan_downgrade dans schema.sql).
   Reactiver repasse "archived" à false ; le trigger enforce_habit_limit
   rejette en base si le plan free a deja 3 habitudes actives — meme
   garde-fou que la creation, pas de logique de limite dupliquee ici. */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var listEl = document.getElementById('archived-list');

  if (!window.ITBOY.isSupabaseConfigured) {
    window.ITBOY.ui.showConfigBanner(bannerZone);
    return;
  }

  var user = null;
  var activeCount = 0;
  var archivedHabits = [];

  function renderList() {
    if (!archivedHabits.length) {
      listEl.innerHTML = '<p class="empty-state">Aucune habitude archivée pour l\'instant.</p>';
      return;
    }

    listEl.innerHTML = archivedHabits.map(function (h) {
      return '<div class="habit-row" data-habit-id="' + h.id + '">' +
        '<div class="info">' +
        '<span class="name">' + window.ITBOY.ui.escapeHtml(h.name) + '</span>' +
        '<span class="category">' + (window.ITBOY.CATEGORY_LABELS[h.category] || h.category) + '</span>' +
        '</div>' +
        '<button class="reactivate-btn" data-action="reactivate">Réactiver</button>' +
        '</div>';
    }).join('');

    listEl.querySelectorAll('[data-action="reactivate"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        reactivate(btn.closest('.habit-row').getAttribute('data-habit-id'), btn);
      });
    });
  }

  async function reactivate(habitId, btn) {
    bannerZone.innerHTML = '';
    btn.disabled = true;
    try {
      await window.ITBOY.api.reactivateHabit(habitId, activeCount + 1);
      activeCount += 1;
      archivedHabits = archivedHabits.filter(function (h) { return h.id !== habitId; });
      renderList();
      bannerZone.innerHTML = '<div class="banner-info">Habitude réactivée — retrouve-la sur <a href="../dashboard/">ton tableau de bord</a>.</div>';
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
      btn.disabled = false;
    }
  }

  async function init() {
    user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    window.ITBOY.ui.mountNav('');

    try {
      var activeHabits = await window.ITBOY.api.getHabits(user.id, { archived: false });
      activeCount = activeHabits.length;
      archivedHabits = await window.ITBOY.api.getArchivedHabits(user.id);
      renderList();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
