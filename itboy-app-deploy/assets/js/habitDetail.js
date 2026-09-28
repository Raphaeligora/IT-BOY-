/* IT BOY — Écran /habits/?id=<uuid> (route "[id]" du spec, adaptée en
   query string puisque ce site est statique, sans routeur serveur). */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var nameEl = document.getElementById('habit-name');
  var categoryEl = document.getElementById('habit-category');
  var statsEl = document.getElementById('habit-stats');
  var heatmapEl = document.getElementById('heatmap');
  var heatmapMonthsEl = document.getElementById('heatmap-months');

  var MONTH_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  function getHabitIdFromQuery() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function statTile(value, label) {
    return '<div class="stat-tile"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>';
  }

  // Heatmap annuelle façon GitHub : colonnes = semaines (lun -> dim),
  // alignée sur la semaine en cours et remontant weeksToShow semaines en
  // arrière. Free : 5 semaines affichées (limite d'affichage, pas de
  // sécurité — voir plans.js). Premium : 53 semaines (~année complète).
  function renderYearHeatmap(dates, weeksToShow) {
    var done = {};
    dates.forEach(function (d) { done[d] = true; });

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var dow = today.getDay(); // 0 = dim ... 6 = sam
    var mondayOffset = dow === 0 ? 6 : dow - 1;
    var currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - mondayOffset);

    var startMonday = new Date(currentMonday);
    startMonday.setDate(currentMonday.getDate() - (weeksToShow - 1) * 7);

    var weeks = [];
    var monthLabels = [];
    var lastMonth = null;

    for (var w = 0; w < weeksToShow; w++) {
      var weekStart = new Date(startMonday);
      weekStart.setDate(startMonday.getDate() + w * 7);
      var weekCells = [];
      var monthLabel = '';

      for (var d = 0; d < 7; d++) {
        var cellDate = new Date(weekStart);
        cellDate.setDate(weekStart.getDate() + d);
        var str = window.ITBOY.streak._dateStr(cellDate);
        weekCells.push({ str: str, done: !!done[str], future: cellDate > today });

        if (d === 0 && cellDate.getMonth() !== lastMonth) {
          monthLabel = MONTH_ABBR[cellDate.getMonth()];
          lastMonth = cellDate.getMonth();
        }
      }

      weeks.push(weekCells);
      monthLabels.push(monthLabel);
    }

    if (heatmapMonthsEl) {
      heatmapMonthsEl.innerHTML = monthLabels.map(function (l) { return '<span>' + l + '</span>'; }).join('');
    }

    heatmapEl.innerHTML = weeks.map(function (week) {
      return '<div class="week-col">' + week.map(function (c) {
        var cls = 'cell' + (c.future ? ' empty' : (c.done ? ' done' : ''));
        return '<span class="' + cls + '" title="' + c.str + '"></span>';
      }).join('') + '</div>';
    }).join('');
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

      var weeksToShow = isPremium ? 53 : 5;
      renderYearHeatmap(dates, weeksToShow);
      var captionEl = document.getElementById('heatmap-caption');
      if (captionEl) {
        captionEl.textContent = isPremium ? 'Année écoulée' : '5 dernières semaines — Premium débloque l\'année complète';
      }
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
