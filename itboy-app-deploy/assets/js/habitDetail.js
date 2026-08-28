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

  function renderHeatmap(dates) {
    var done = {};
    dates.forEach(function (d) { done[d] = true; });

    var today = new Date();
    var cells = [];
    for (var i = 29; i >= 0; i--) {
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
      var habit = await window.ITBOY.api.getHabit(habitId);
      var logs = await window.ITBOY.api.getLogs(habitId);
      var dates = logs.map(function (l) { return l.completed_date; });
      var today = window.ITBOY.api.todayStr();

      nameEl.textContent = habit.name;
      categoryEl.textContent = window.ITBOY.CATEGORY_LABELS[habit.category] || habit.category;

      var current = window.ITBOY.streak.computeCurrentStreak(dates, today);
      var best = window.ITBOY.streak.computeBestStreak(dates);
      var rate7 = window.ITBOY.streak.completionRate(dates, 7, today);
      var rate30 = window.ITBOY.streak.completionRate(dates, 30, today);

      statsEl.innerHTML =
        statTile(current, 'Streak actuel') +
        statTile(best, 'Meilleur streak') +
        statTile(rate7 + '%', 'Sur 7 jours') +
        statTile(rate30 + '%', 'Sur 30 jours');

      renderHeatmap(dates);
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
