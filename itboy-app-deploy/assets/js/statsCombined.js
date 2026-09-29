/* IT BOY — Écran /stats/combined (comparaison multi-habitudes, Premium).
   Meme gating que /stats/ et la page detail habitude (cf. "Statistiques
   detaillees" dans plans.js). La selection (jusqu'a 4 habitudes) est
   portee par l'URL (?ids=uuid,uuid) pour rester partageable/rechargeable,
   sans etat serveur dedie. */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var zone = document.getElementById('combined-zone');
  var MAX_SELECTED = 4;

  if (!window.ITBOY.isSupabaseConfigured) {
    window.ITBOY.ui.showConfigBanner(bannerZone);
    return;
  }

  var habits = [];
  var logsByHabit = {};
  var selectedIds = [];

  function today() { return window.ITBOY.api.todayStr(); }

  function renderLockedTeaser() {
    zone.innerHTML = '<div class="locked-card">' +
      '<div class="lock-icon">🔒</div>' +
      '<p>Débloque la comparaison côte à côte de tes calendriers d\'habitudes avec le plan Premium.</p>' +
      '<a class="cta-btn ghost" href="../../plans/">Découvrir Premium</a>' +
      '</div>';
  }

  function syncUrl() {
    var params = new URLSearchParams(window.location.search);
    if (selectedIds.length) params.set('ids', selectedIds.join(','));
    else params.delete('ids');
    var qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  function toggleHabit(id) {
    var idx = selectedIds.indexOf(id);
    if (idx !== -1) {
      selectedIds.splice(idx, 1);
    } else {
      if (selectedIds.length >= MAX_SELECTED) return;
      selectedIds.push(id);
    }
    syncUrl();
    render();
  }

  function renderChips() {
    var atMax = selectedIds.length >= MAX_SELECTED;
    var chips = habits.map(function (h) {
      var active = selectedIds.indexOf(h.id) !== -1;
      var disabled = !active && atMax;
      return '<button type="button" class="select-chip' + (active ? ' active' : '') + '"' +
        (disabled ? ' disabled' : '') + ' data-habit-id="' + h.id + '">' +
        window.ITBOY.ui.escapeHtml(h.name) + '</button>';
    }).join('');

    return '<div class="select-chip-row">' + chips + '</div>' +
      '<p class="select-chip-note">' + selectedIds.length + '/' + MAX_SELECTED + ' sélectionnée' + (selectedIds.length > 1 ? 's' : '') + '.</p>';
  }

  // Heatmap annuelle façon GitHub, identique à celle de la page détail
  // habitude (assets/js/habitDetail.js) mais paramétrée par des éléments
  // cibles plutôt que des ids fixes, puisqu'ici il y en a plusieurs sur
  // la même page (une par habitude comparée).
  var MONTH_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  function renderYearHeatmap(dates, monthsEl, gridEl) {
    var done = {};
    dates.forEach(function (d) { done[d] = true; });

    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var dow = now.getDay();
    var mondayOffset = dow === 0 ? 6 : dow - 1;
    var currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - mondayOffset);

    var weeksToShow = 53;
    var startMonday = new Date(currentMonday);
    startMonday.setDate(currentMonday.getDate() - (weeksToShow - 1) * 7);

    var weeks = [];
    var monthLabels = [];
    var lastMonth = null;
    var lastLabelWeek = -Infinity;

    for (var w = 0; w < weeksToShow; w++) {
      var weekStart = new Date(startMonday);
      weekStart.setDate(startMonday.getDate() + w * 7);
      var weekCells = [];
      var monthLabel = '';

      for (var d = 0; d < 7; d++) {
        var cellDate = new Date(weekStart);
        cellDate.setDate(weekStart.getDate() + d);
        var str = window.ITBOY.streak._dateStr(cellDate);
        weekCells.push({ str: str, done: !!done[str], future: cellDate > now });

        if (d === 0 && cellDate.getMonth() !== lastMonth) {
          lastMonth = cellDate.getMonth();
          if (w - lastLabelWeek >= 3) {
            monthLabel = MONTH_ABBR[cellDate.getMonth()];
            lastLabelWeek = w;
          }
        }
      }

      weeks.push(weekCells);
      monthLabels.push(monthLabel);
    }

    monthsEl.innerHTML = monthLabels.map(function (l) { return '<span>' + l + '</span>'; }).join('');
    gridEl.innerHTML = weeks.map(function (week) {
      return '<div class="week-col">' + week.map(function (c) {
        var cls = 'cell' + (c.future ? ' empty' : (c.done ? ' done' : ''));
        return '<span class="' + cls + '" title="' + c.str + '"></span>';
      }).join('') + '</div>';
    }).join('');
  }

  function renderCards() {
    var selectedHabits = habits.filter(function (h) { return selectedIds.indexOf(h.id) !== -1; });

    if (!selectedHabits.length) {
      return '<p class="empty-state">Sélectionne au moins une habitude ci-dessus pour afficher son calendrier.</p>';
    }

    return selectedHabits.map(function (h, i) {
      var dates = logsByHabit[h.id] || [];
      var streak = window.ITBOY.streak.computeCurrentStreak(dates, today());
      var best = window.ITBOY.streak.computeBestStreak(dates);
      var rate30 = window.ITBOY.streak.completionRate(dates, 30, today());

      return '<div class="compare-card">' +
        '<div class="compare-head">' +
        '<div><span class="compare-name">' + window.ITBOY.ui.escapeHtml(h.name) + '</span>' +
        '<span class="compare-category">' + (window.ITBOY.CATEGORY_LABELS[h.category] || h.category) + '</span></div>' +
        '<div class="compare-metrics">' +
        '<div class="metric"><div class="value">' + streak + '</div><div class="label">Streak</div></div>' +
        '<div class="metric"><div class="value">' + best + '</div><div class="label">Record</div></div>' +
        '<div class="metric"><div class="value">' + rate30 + '%</div><div class="label">30j</div></div>' +
        '</div>' +
        '</div>' +
        '<div class="year-heatmap-wrap">' +
        '<div class="year-heatmap-scroll">' +
        '<div class="year-heatmap-months" id="compare-months-' + i + '"></div>' +
        '<div class="year-heatmap-body">' +
        '<div class="year-heatmap-daylabels"><span>Lun</span><span></span><span>Mer</span><span></span><span>Ven</span><span></span><span></span></div>' +
        '<div class="year-heatmap" id="compare-grid-' + i + '"></div>' +
        '</div></div></div>' +
        '</div>';
    }).join('');
  }

  function render() {
    zone.innerHTML = renderChips() + renderCards();

    zone.querySelectorAll('[data-habit-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleHabit(btn.getAttribute('data-habit-id')); });
    });

    habits.filter(function (h) { return selectedIds.indexOf(h.id) !== -1; }).forEach(function (h, i) {
      var monthsEl = document.getElementById('compare-months-' + i);
      var gridEl = document.getElementById('compare-grid-' + i);
      if (monthsEl && gridEl) renderYearHeatmap(logsByHabit[h.id] || [], monthsEl, gridEl);
    });
  }

  async function init() {
    var user = await window.ITBOY.auth.requireUser();
    if (!user) return;

    window.ITBOY.ui.mountNav('stats');

    try {
      var profile = await window.ITBOY.api.getProfile(user.id);
      if (profile.plan !== 'premium') { renderLockedTeaser(); return; }

      habits = await window.ITBOY.api.getHabits(user.id, { archived: false });
      if (!habits.length) {
        zone.innerHTML = '<p class="empty-state">Aucune habitude active à comparer pour l\'instant.</p>';
        return;
      }

      var allLogs = await window.ITBOY.api.getLogsForUser(user.id);
      logsByHabit = {};
      habits.forEach(function (h) { logsByHabit[h.id] = []; });
      allLogs.forEach(function (log) {
        if (logsByHabit[log.habit_id]) logsByHabit[log.habit_id].push(log.completed_date);
      });

      var habitIds = habits.map(function (h) { return h.id; });
      var fromQuery = (new URLSearchParams(window.location.search).get('ids') || '')
        .split(',').filter(function (id) { return habitIds.indexOf(id) !== -1; });

      selectedIds = fromQuery.length ? fromQuery.slice(0, MAX_SELECTED) : habitIds.slice(0, 2);
      syncUrl();
      render();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
