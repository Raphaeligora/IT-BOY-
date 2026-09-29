/* IT BOY — Écran /stats (vue globale, toutes habitudes actives confondues).
   Fonctionnalité Premium (cf. "Statistiques détaillées" dans plans.js,
   même logique de gating que assets/js/habitDetail.js) : un compte Free
   voit une carte de teasing, un compte Premium la vue complète.
   Streak/coches/taux se calculent TOUJOURS sur l'historique complet,
   jamais borné par une limite d'affichage — cf. note dans habitDetail.js. */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var zone = document.getElementById('stats-zone');

  if (!window.ITBOY.isSupabaseConfigured) {
    window.ITBOY.ui.showConfigBanner(bannerZone);
    return;
  }

  var CATEGORY_COLORS = {
    sante: '#CDA34E',
    productivite: '#E0BC66',
    mindset: 'rgba(246,246,246,0.55)',
    finance: 'rgba(138,138,138,0.75)'
  };
  var MONTH_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  function monthlyDistribution(dates, year) {
    var counts = new Array(12).fill(0);
    dates.forEach(function (d) {
      if (d.slice(0, 4) === String(year)) counts[parseInt(d.slice(5, 7), 10) - 1] += 1;
    });
    return counts;
  }

  function yearsInData(dates) {
    var years = {};
    dates.forEach(function (d) { years[d.slice(0, 4)] = true; });
    years[String(new Date().getFullYear())] = true;
    return Object.keys(years).sort();
  }

  function renderLockedTeaser() {
    zone.innerHTML = '<div class="locked-card">' +
      '<div class="lock-icon">🔒</div>' +
      '<p>Débloque la vue d\'ensemble de toutes tes habitudes, la répartition par catégorie et la distribution mensuelle avec le plan Premium.</p>' +
      '<a class="cta-btn ghost" href="../plans/">Découvrir Premium</a>' +
      '</div>';
  }

  var monthlyChart = null;
  var categoryChart = null;

  function renderStats(habits, logsByHabit, allDates, today) {
    var totalCheckins = allDates.length;
    var bestStreak = habits.reduce(function (max, h) {
      return Math.max(max, window.ITBOY.streak.computeCurrentStreak(logsByHabit[h.id] || [], today));
    }, 0);
    var avgRate7 = habits.length
      ? Math.round(habits.reduce(function (sum, h) {
          return sum + window.ITBOY.streak.completionRate(logsByHabit[h.id] || [], 7, today);
        }, 0) / habits.length)
      : 0;
    var years = yearsInData(allDates);
    var currentYear = String(new Date().getFullYear());

    var byCategory = {};
    habits.forEach(function (h) {
      var count = (logsByHabit[h.id] || []).length;
      byCategory[h.category] = (byCategory[h.category] || 0) + count;
    });
    var categoryKeys = Object.keys(byCategory).filter(function (k) { return byCategory[k] > 0; });

    var habitRows = habits.slice().sort(function (a, b) {
      return (logsByHabit[b.id] || []).length - (logsByHabit[a.id] || []).length;
    }).map(function (h) {
      var dates = logsByHabit[h.id] || [];
      var streak = window.ITBOY.streak.computeCurrentStreak(dates, today);
      return '<a class="habit-summary-row" href="../habits/?id=' + h.id + '">' +
        '<div class="info">' +
        '<span class="name">' + window.ITBOY.ui.escapeHtml(h.name) + '</span>' +
        '<span class="category">' + (window.ITBOY.CATEGORY_LABELS[h.category] || h.category) + '</span>' +
        '</div>' +
        '<div class="totals">' +
        '<div class="metric"><div class="value">' + streak + '</div><div class="label">Streak</div></div>' +
        '<div class="metric"><div class="value">' + dates.length + '</div><div class="label">Coches</div></div>' +
        '</div>' +
        '</a>';
    }).join('');

    zone.innerHTML =
      '<div class="detailed-stats-grid">' +
      '<div class="stat-tile"><div class="value">' + habits.length + '</div><div class="label">Habitude' + (habits.length > 1 ? 's' : '') + ' active' + (habits.length > 1 ? 's' : '') + '</div></div>' +
      '<div class="stat-tile"><div class="value">' + totalCheckins + '</div><div class="label">Coche' + (totalCheckins > 1 ? 's' : '') + ' au total</div></div>' +
      '<div class="stat-tile"><div class="value">' + bestStreak + '</div><div class="label">Meilleur streak</div></div>' +
      '<div class="stat-tile"><div class="value">' + avgRate7 + '%</div><div class="label">Taux moyen 7j</div></div>' +
      '</div>' +
      '<div class="detailed-stats-heading">Vue d\'ensemble</div>' +
      '<div class="chart-card">' +
      '<div class="chart-head">' +
      '<span class="chart-title">Distribution mensuelle (toutes habitudes)</span>' +
      (years.length > 1
        ? '<select class="form-select" id="chart-year-select" style="padding:8px 12px;font-size:12px;width:auto">' +
          years.map(function (y) { return '<option value="' + y + '"' + (y === currentYear ? ' selected' : '') + '>' + y + '</option>'; }).join('') +
          '</select>'
        : '<span class="link-muted">' + currentYear + '</span>') +
      '</div>' +
      '<div class="chart-body"><canvas id="monthly-chart"></canvas></div>' +
      '</div>' +
      (categoryKeys.length
        ? '<div class="chart-card">' +
          '<div class="chart-head"><span class="chart-title">Répartition des coches par catégorie</span></div>' +
          '<div class="chart-body donut"><canvas id="category-chart" width="180" height="180"></canvas></div>' +
          '<div class="chart-legend">' + categoryKeys.map(function (k) {
            return '<span><span class="swatch" style="background:' + CATEGORY_COLORS[k] + '"></span>' + (window.ITBOY.CATEGORY_LABELS[k] || k) + '</span>';
          }).join('') + '</div>' +
          '</div>'
        : '') +
      '<div class="detailed-stats-heading">Tes habitudes</div>' +
      '<div class="habit-list" style="margin-bottom:0">' + (habitRows || '<p class="empty-state" style="padding:24px 0">Aucune habitude active pour l\'instant.</p>') + '</div>';

    if (!window.Chart) return; // CDN indisponible - tuiles/liste restent visibles

    var yearSelect = document.getElementById('chart-year-select');
    function drawMonthly(year) {
      var ctx = document.getElementById('monthly-chart');
      if (!ctx) return;
      if (monthlyChart) monthlyChart.destroy();
      monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: MONTH_ABBR, datasets: [{ data: monthlyDistribution(allDates, year), backgroundColor: 'rgba(205,163,78,0.75)', borderRadius: 3, maxBarThickness: 28 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8A8A8A', font: { family: 'Montserrat' } } },
            y: { beginAtZero: true, ticks: { color: '#8A8A8A', precision: 0, font: { family: 'Montserrat' } }, grid: { color: 'rgba(246,246,246,0.06)' } }
          }
        }
      });
    }
    drawMonthly(parseInt(yearSelect ? yearSelect.value : currentYear, 10));
    if (yearSelect) yearSelect.addEventListener('change', function () { drawMonthly(parseInt(yearSelect.value, 10)); });

    if (categoryKeys.length) {
      var catCtx = document.getElementById('category-chart');
      if (catCtx) {
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(catCtx, {
          type: 'doughnut',
          data: {
            labels: categoryKeys.map(function (k) { return window.ITBOY.CATEGORY_LABELS[k] || k; }),
            datasets: [{ data: categoryKeys.map(function (k) { return byCategory[k]; }), backgroundColor: categoryKeys.map(function (k) { return CATEGORY_COLORS[k]; }), borderWidth: 0 }]
          },
          options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
        });
      }
    }
  }

  async function init() {
    window.ITBOY.ui.showLoading(zone);

    var user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    window.ITBOY.ui.mountNav('stats');

    try {
      var profile = await window.ITBOY.api.getProfile(user.id);
      var isPremium = profile.plan === 'premium';
      if (!isPremium) { renderLockedTeaser(); return; }

      var habits = await window.ITBOY.api.getHabits(user.id, { archived: false });
      var allLogs = await window.ITBOY.api.getLogsForUser(user.id);
      var logsByHabit = {};
      habits.forEach(function (h) { logsByHabit[h.id] = []; });
      allLogs.forEach(function (log) {
        if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = [];
        logsByHabit[log.habit_id].push(log.completed_date);
      });
      var allDates = allLogs.map(function (l) { return l.completed_date; });
      var today = window.ITBOY.api.todayStr();

      renderStats(habits, logsByHabit, allDates, today);
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
