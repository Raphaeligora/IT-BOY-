/* IT BOY — Écran /habits/?id=<uuid> (route "[id]" du spec, adaptée en
   query string puisque ce site est statique, sans routeur serveur). */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var nameEl = document.getElementById('habit-name');
  var categoryEl = document.getElementById('habit-category');
  var statsEl = document.getElementById('habit-stats');
  var heatmapEl = document.getElementById('heatmap');

  function getHabitIdFromQuery() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function statTile(value, label) {
    return '<div class="stat-tile"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>';
  }

  // Free : 30 derniers jours affichés (limite d'affichage, pas de sécurité
  // — voir plans.js). Premium : historique complet, borné à la première
  // habitude créée si elle est plus jeune que ~1 an.
  function renderHeatmap(dates, days) {
    var done = {};
    dates.forEach(function (d) { done[d] = true; });

    var today = new Date();
    var cells = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var str = window.ITBOY.streak._dateStr(d);
      cells.push('<div class="cell' + (done[str] ? ' done' : '') + '" title="' + str + '"></div>');
    }
    heatmapEl.innerHTML = cells.join('');
  }

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      return;
    }

    var user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    var habitId = getHabitIdFromQuery();
    if (!habitId) {
      window.ITBOY.ui.showError(bannerZone, new Error('Aucune habitude spécifiée.'));
      return;
    }

    try {
      var profile = await window.ITBOY.api.getProfile(user.id);
      var isPremium = profile.plan === 'premium';

      var habit = await window.ITBOY.api.getHabit(habitId);
      var logs = await window.ITBOY.api.getLogs(habitId);
      var dates = logs.map(function (l) { return l.completed_date; });
      var today = window.ITBOY.api.todayStr();

      nameEl.textContent = habit.name;
      categoryEl.textContent = window.ITBOY.CATEGORY_LABELS[habit.category] || habit.category;

      // Le streak/taux se calcule TOUJOURS sur l'historique complet, même en
      // Free : la limite d'affichage ne doit jamais fausser un vrai streak
      // de plus de 30 jours (voir note dans plans.js).
      var current = window.ITBOY.streak.computeCurrentStreak(dates, today);
      var best = window.ITBOY.streak.computeBestStreak(dates);
      var rate7 = window.ITBOY.streak.completionRate(dates, 7, today);
      var rate30 = window.ITBOY.streak.completionRate(dates, 30, today);

      statsEl.innerHTML =
        statTile(current, 'Streak actuel') +
        statTile(best, 'Meilleur streak') +
        statTile(rate7 + '%', 'Sur 7 jours') +
        statTile(rate30 + '%', 'Sur 30 jours');

      var heatmapDays = isPremium ? 90 : 30;
      renderHeatmap(dates, heatmapDays);
      var captionEl = document.getElementById('heatmap-caption');
      if (captionEl) {
        captionEl.textContent = isPremium ? '90 derniers jours' : '30 derniers jours — Premium débloque l\'historique complet';
      }
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
