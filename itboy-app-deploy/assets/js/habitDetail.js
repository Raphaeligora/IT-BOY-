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
    var lastLabelWeek = -Infinity; // évite deux labels trop rapprochés (se chevaucheraient)

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

  function monthKey(dateStr) { return dateStr.slice(0, 7); }

  function countInMonth(dates, key) {
    return dates.filter(function (d) { return monthKey(d) === key; }).length;
  }

  function countThisWeek(dates, todayStr) {
    var parts = todayStr.split('-').map(Number);
    var today = new Date(parts[0], parts[1] - 1, parts[2]);
    var dow = today.getDay();
    var mondayOffset = dow === 0 ? 6 : dow - 1;
    var monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    var mondayStr = window.ITBOY.streak._dateStr(monday);
    return dates.filter(function (d) { return d >= mondayStr && d <= todayStr; }).length;
  }

  function daysSinceLast(dates, todayStr) {
    if (!dates.length) return null;
    var last = dates.slice().sort().pop();
    var pa = todayStr.split('-').map(Number);
    var pb = last.split('-').map(Number);
    var a = new Date(pa[0], pa[1] - 1, pa[2]);
    var b = new Date(pb[0], pb[1] - 1, pb[2]);
    return Math.round((a - b) / 86400000);
  }

  function bestMonth(dates) {
    if (!dates.length) return null;
    var counts = {};
    dates.forEach(function (d) { var k = monthKey(d); counts[k] = (counts[k] || 0) + 1; });
    var keys = Object.keys(counts);
    var bestKey = keys.reduce(function (best, k) { return counts[k] > counts[best] ? k : best; }, keys[0]);
    var parts = bestKey.split('-');
    return { label: MONTH_ABBR[parseInt(parts[1], 10) - 1] + ' ' + parts[0], count: counts[bestKey] };
  }

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
    var currentYear = String(new Date().getFullYear());
    years[currentYear] = true;
    return Object.keys(years).sort();
  }

  function renderLockedTeaser(zone) {
    zone.innerHTML = '<div class="detailed-stats-heading">Statistiques détaillées</div>' +
      '<div class="locked-card">' +
      '<div class="lock-icon">🔒</div>' +
      '<p>Débloque la répartition mensuelle, le taux de complétion et les stats avancées avec le plan Premium.</p>' +
      '<a class="cta-btn ghost" href="../plans/">Découvrir Premium</a>' +
      '</div>';
  }

  var monthlyChart = null;
  var donutChart = null;

  // Statistiques détaillées (Premium, cf. plans.js) : 4 tuiles
  // supplémentaires + distribution mensuelle (Chart.js) + taux de
  // complétion. Toujours calculées sur l'historique complet, jamais
  // borné par la limite d'affichage du heatmap.
  function renderDetailedStats(zone, dates, today) {
    var thisMonthKey = today.slice(0, 7);
    var currentYear = String(new Date().getFullYear());
    var thisMonth = countInMonth(dates, thisMonthKey);
    var thisWeek = countThisWeek(dates, today);
    var sinceLast = daysSinceLast(dates, today);
    var best = bestMonth(dates);
    var years = yearsInData(dates);

    zone.innerHTML =
      '<div class="detailed-stats-heading">Statistiques détaillées</div>' +
      '<div class="detailed-stats-grid">' +
      statTile(dates.length, 'Total') +
      statTile(thisMonth, 'Ce mois') +
      statTile(thisWeek, 'Cette semaine') +
      statTile(sinceLast === null ? '—' : sinceLast, 'Jours depuis dernière') +
      '</div>' +
      (best ? '<p class="plan-note" style="margin:2px 0 24px">Meilleur mois : <strong style="color:var(--white)">' + best.label + '</strong> (' + best.count + ' coche' + (best.count > 1 ? 's' : '') + ')</p>' : '<div style="margin-bottom:16px"></div>') +
      '<div class="chart-card">' +
      '<div class="chart-head">' +
      '<span class="chart-title">Distribution mensuelle</span>' +
      (years.length > 1
        ? '<select class="form-select" id="chart-year-select" style="padding:8px 12px;font-size:12px;width:auto">' +
          years.map(function (y) { return '<option value="' + y + '"' + (y === currentYear ? ' selected' : '') + '>' + y + '</option>'; }).join('') +
          '</select>'
        : '<span class="link-muted">' + currentYear + '</span>') +
      '</div>' +
      '<div class="chart-body"><canvas id="monthly-chart"></canvas></div>' +
      '</div>' +
      '<div class="chart-card">' +
      '<div class="chart-head">' +
      '<span class="chart-title">Taux de complétion</span>' +
      '<div class="tab-bar" id="donut-toggle" style="margin:0">' +
      '<button class="tab-btn active" type="button" data-range="month">Mois en cours</button>' +
      '<button class="tab-btn" type="button" data-range="year">Année</button>' +
      '</div>' +
      '</div>' +
      '<div class="chart-body donut"><canvas id="donut-chart" width="180" height="180"></canvas></div>' +
      '<div class="chart-legend"><span><span class="swatch" style="background:var(--gold)"></span>Jours cochés</span><span><span class="swatch" style="background:rgba(246,246,246,0.15)"></span>Jours non cochés</span></div>' +
      '</div>';

    if (!window.Chart) return; // CDN indisponible (offline, bloqueur) - tuiles restent visibles, graphiques simplement absents

    var yearSelect = document.getElementById('chart-year-select');
    function drawMonthly(year) {
      var ctx = document.getElementById('monthly-chart');
      if (!ctx) return;
      if (monthlyChart) monthlyChart.destroy();
      monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: MONTH_ABBR, datasets: [{ data: monthlyDistribution(dates, year), backgroundColor: 'rgba(205,163,78,0.75)', borderRadius: 3, maxBarThickness: 28 }] },
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

    function drawDonut(range) {
      var done, notDone;
      if (range === 'month') {
        var dayOfMonth = parseInt(today.slice(8, 10), 10);
        done = thisMonth;
        notDone = Math.max(dayOfMonth - done, 0);
      } else {
        var startOfYear = new Date(parseInt(currentYear, 10), 0, 1);
        var daysElapsed = Math.round((new Date() - startOfYear) / 86400000) + 1;
        done = dates.filter(function (d) { return d.slice(0, 4) === currentYear; }).length;
        notDone = Math.max(daysElapsed - done, 0);
      }
      var ctx = document.getElementById('donut-chart');
      if (!ctx) return;
      if (donutChart) donutChart.destroy();
      donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Cochés', 'Non cochés'], datasets: [{ data: [done, notDone], backgroundColor: ['#CDA34E', 'rgba(246,246,246,0.12)'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
      });
    }
    drawDonut('month');
    var donutToggle = document.getElementById('donut-toggle');
    if (donutToggle) {
      donutToggle.querySelectorAll('[data-range]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          donutToggle.querySelectorAll('[data-range]').forEach(function (b) { b.classList.toggle('active', b === btn); });
          drawDonut(btn.getAttribute('data-range'));
        });
      });
    }
  }

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      return;
    }

    var user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    window.ITBOY.ui.mountNav('');

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

      var detailedZone = document.getElementById('detailed-stats-zone');
      if (detailedZone) {
        if (isPremium) renderDetailedStats(detailedZone, dates, today);
        else renderLockedTeaser(detailedZone);
      }
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
