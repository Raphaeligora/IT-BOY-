/* IT BOY - Ecran /dashboard (tracker principal)
   La limite de plan affichee/desactivee ici est un confort d'UI : la
   verite est appliquee en base par le trigger `enforce_habit_limit`
   (voir supabase/schema.sql) - un rejet serveur est toujours possible
   et affiche tel quel (course entre deux onglets, etc.). */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var overviewEl = document.getElementById('overview-stats');
  var limitNoteEl = document.getElementById('plan-limit-note');
  var todayProgressEl = document.getElementById('today-progress');
  var listEl = document.getElementById('habit-list');
  var addToggleBtn = document.getElementById('add-habit-toggle');
  var addForm = document.getElementById('add-habit-form');
  var frequencySelect = document.getElementById('frequency-select');
  var frequencyCountLabel = document.getElementById('frequency-count-label');

  var sortToggleEl = document.getElementById('sort-toggle');
  var greetingEl = document.getElementById('greeting');

  var user = null;
  var profile = null;
  var habits = [];      // habitudes actives, dans l'ordre "position" (tri manuel) tel que renvoye par l'API
  var logsByHabit = {};  // habitId -> [completed_date, ...]
  // Total de coches tous logs confondus (y compris habitudes archivees,
  // cf. getLogsForUser) - tenu a jour localement sans refetch a chaque
  // coche/decoche pour le bandeau de vue d'ensemble.
  var totalCheckins = 0;
  // 'activity' (par defaut) : la plus recemment cochee en premier.
  // 'manual' : ordre choisi par glisser-deposer, persiste en base (habits.position).
  var sortMode = 'activity';
  var draggedHabitId = null;

  // Recalculee a chaque usage (jamais mise en cache) : si l'onglet reste
  // ouvert a cheval sur minuit, un "coché aujourd'hui" doit refleter le
  // nouveau jour, pas rester bloqué sur la date du chargement de la page.
  function todayStr() { return window.ITBOY.api.todayStr(); }

  function planLimit() {
    return window.ITBOY.PLAN_LIMITS[profile.plan] || 3;
  }

  function renderLimitNote() {
    var isPremium = profile.plan === 'premium';
    limitNoteEl.textContent = isPremium
      ? habits.length + ' habitude' + (habits.length > 1 ? 's' : '') + ' active' + (habits.length > 1 ? 's' : '') + ' - plan Premium (illimité).'
      : habits.length + '/' + planLimit() + ' habitudes actives - plan Free.';
  }

  // Bandeau de vue d'ensemble : nb d'habitudes actives, total de coches
  // (tous logs confondus, y compris habitudes archivees), et le meilleur
  // streak en cours parmi les habitudes actives.
  function renderOverview() {
    if (!overviewEl) return;
    var today = todayStr();
    var bestStreak = habits.reduce(function (max, h) {
      var streak = window.ITBOY.streak.computeCurrentStreak(logsByHabit[h.id] || [], today);
      return Math.max(max, streak);
    }, 0);

    overviewEl.innerHTML =
      '<div class="stat-tile"><div class="value">' + habits.length + '</div><div class="label">Habitude' + (habits.length > 1 ? 's' : '') + ' active' + (habits.length > 1 ? 's' : '') + '</div></div>' +
      '<div class="stat-tile"><div class="value">' + totalCheckins + '</div><div class="label">Coche' + (totalCheckins > 1 ? 's' : '') + ' au total</div></div>' +
      '<div class="stat-tile"><div class="value">' + bestStreak + '</div><div class="label">Meilleur streak actuel</div></div>';
  }

  // 7 derniers jours (dont aujourd'hui), du plus ancien au plus recent -
  // sert au mini historique par habitude et reutilise todayStr() comme
  // seule source de verite pour "aujourd'hui" (coherent avec le reste).
  function lastNDaysStr(n) {
    var pad = function (x) { return String(x).padStart(2, '0'); };
    var parts = todayStr().split('-').map(Number);
    var base = new Date(parts[0], parts[1] - 1, parts[2]);
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(base);
      d.setDate(base.getDate() - i);
      out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()));
    }
    return out;
  }

  function renderTodayProgress() {
    if (!todayProgressEl) return;
    if (!habits.length) { todayProgressEl.innerHTML = ''; return; }

    var today = todayStr();
    var doneCount = habits.filter(function (h) {
      return (logsByHabit[h.id] || []).indexOf(today) !== -1;
    }).length;
    var pct = Math.round((doneCount / habits.length) * 100);

    todayProgressEl.innerHTML =
      '<div class="today-progress">' +
      '<div class="today-progress-track"><div class="today-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="today-progress-label">' + doneCount + '/' + habits.length + ' faites</span>' +
      '</div>';
  }

  // "Par activité" : la plus recemment cochee en premier (habitude jamais
  // cochee = renvoyee a la fin). "Manuel" : ordre "position" tel que recu
  // de l'API (habits n'est jamais re-trie dans ce mode).
  function displayHabits() {
    if (sortMode !== 'activity') return habits;
    return habits.slice().sort(function (a, b) {
      var datesA = logsByHabit[a.id] || [];
      var datesB = logsByHabit[b.id] || [];
      var lastA = datesA.length ? datesA.slice().sort().pop() : '';
      var lastB = datesB.length ? datesB.slice().sort().pop() : '';
      if (lastA === lastB) return a.name.localeCompare(b.name);
      return lastA < lastB ? 1 : -1;
    });
  }

  function renderHabitList() {
    if (!habits.length) {
      listEl.innerHTML = '<p class="page-subtitle" style="margin:0">Aucune habitude active pour l\'instant.</p>';
      return;
    }

    var week = lastNDaysStr(7);
    var today = todayStr();
    var manual = sortMode === 'manual';

    listEl.innerHTML = displayHabits().map(function (h) {
      var dates = logsByHabit[h.id] || [];
      var doneToday = dates.indexOf(today) !== -1;
      var streak = window.ITBOY.streak.computeCurrentStreak(dates, today);
      var weekDots = week.map(function (d) {
        return '<span class="d' + (dates.indexOf(d) !== -1 ? ' done' : '') + '"></span>';
      }).join('');
      return '<div class="habit-row' + (manual ? ' draggable' : '') + '" data-habit-id="' + h.id + '"' + (manual ? ' draggable="true"' : '') + '>' +
        (manual ? '<span class="drag-handle" aria-hidden="true">⠿</span>' : '') +
        '<button class="habit-checkbox' + (doneToday ? ' done' : '') + '" data-action="toggle" aria-label="Fait aujourd\'hui"></button>' +
        '<div class="info">' +
        '<span class="name">' + window.ITBOY.ui.escapeHtml(h.name) + '</span>' +
        '<span class="category">' + (window.ITBOY.CATEGORY_LABELS[h.category] || h.category) + '</span>' +
        '<div class="mini-week" aria-hidden="true">' + weekDots + '</div>' +
        '</div>' +
        '<div class="streak-indicator"><span class="dot"></span>' + streak + '</div>' +
        '<a class="detail-link" href="../habits/?id=' + h.id + '">Detail</a>' +
        '<button class="archive-btn" data-action="archive">Archiver</button>' +
        '</div>';
    }).join('');

    listEl.querySelectorAll('[data-action="toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleToday(btn.closest('.habit-row').getAttribute('data-habit-id')); });
    });
    listEl.querySelectorAll('[data-action="archive"]').forEach(function (btn) {
      btn.addEventListener('click', function () { archiveHabit(btn.closest('.habit-row').getAttribute('data-habit-id')); });
    });

    if (manual) bindDragAndDrop();
  }

  // Glisser-deposer natif (HTML5 drag events) pour le tri "Manuel" - pas
  // besoin de librairie externe pour reordonner une petite liste.
  function bindDragAndDrop() {
    listEl.querySelectorAll('.habit-row.draggable').forEach(function (row) {
      row.addEventListener('dragstart', function () {
        draggedHabitId = row.getAttribute('data-habit-id');
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', function () {
        draggedHabitId = null;
        row.classList.remove('dragging');
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
      });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        var targetId = row.getAttribute('data-habit-id');
        if (!draggedHabitId || draggedHabitId === targetId) return;

        var fromIdx = habits.findIndex(function (h) { return h.id === draggedHabitId; });
        var toIdx = habits.findIndex(function (h) { return h.id === targetId; });
        if (fromIdx === -1 || toIdx === -1) return;

        var moved = habits.splice(fromIdx, 1)[0];
        habits.splice(toIdx, 0, moved);
        renderHabitList();

        window.ITBOY.api.reorderHabits(habits.map(function (h) { return h.id; })).catch(function (err) {
          window.ITBOY.ui.showError(bannerZone, err);
        });
      });
    });
  }

  async function toggleToday(habitId) {
    bannerZone.innerHTML = '';
    var today = todayStr();
    var dates = logsByHabit[habitId] || [];
    var doneToday = dates.indexOf(today) !== -1;

    try {
      if (doneToday) {
        await window.ITBOY.api.unmarkDoneToday(habitId);
        logsByHabit[habitId] = dates.filter(function (d) { return d !== today; });
        totalCheckins -= 1;
      } else {
        await window.ITBOY.api.markDoneToday(user.id, habitId);
        logsByHabit[habitId] = dates.concat([today]);
        totalCheckins += 1;
      }
      renderHabitList();
      renderTodayProgress();
      renderOverview();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  async function archiveHabit(habitId) {
    bannerZone.innerHTML = '';
    try {
      await window.ITBOY.api.archiveHabit(habitId);
      habits = habits.filter(function (h) { return h.id !== habitId; });
      renderLimitNote();
      renderHabitList();
      renderTodayProgress();
      renderOverview();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  addToggleBtn.addEventListener('click', function () {
    var atLimit = habits.length >= planLimit();
    if (atLimit) {
      bannerZone.innerHTML = '<div class="banner-warning">Limite de ' + planLimit() + ' habitudes atteinte pour ton plan.</div>';
      return;
    }
    addForm.style.display = addForm.style.display === 'none' ? 'flex' : 'none';
  });

  frequencySelect.addEventListener('change', function () {
    frequencyCountLabel.style.display = frequencySelect.value === 'weekly' ? 'flex' : 'none';
  });

  addForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    bannerZone.innerHTML = '';
    var name = addForm.name.value.trim();
    var category = addForm.category.value;
    var frequency = addForm.frequency.value;
    var frequencyPerWeek = frequency === 'weekly' ? parseInt(addForm.frequencyPerWeek.value, 10) : null;

    if (!name) return;

    try {
      var wasFirstHabit = habits.length === 0;
      var habit = await window.ITBOY.api.createHabit(user.id, {
        name: name, category: category, frequency: frequency,
        frequencyPerWeek: frequencyPerWeek, source: 'custom',
        position: habits.length + 1
      });
      habits.push(habit);
      logsByHabit[habit.id] = [];
      addForm.reset();
      addForm.style.display = 'none';
      renderLimitNote();
      renderHabitList();
      renderTodayProgress();
      renderOverview();
      if (wasFirstHabit) window.ITBOY.track('first_habit_created', { category: category });
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  });

  if (sortToggleEl) {
    sortToggleEl.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-sort');
        if (mode === sortMode) return;
        sortMode = mode;
        sortToggleEl.querySelectorAll('[data-sort]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderHabitList();
      });
    });
  }

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      return;
    }

    user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    window.ITBOY.ui.mountNav('dashboard');

    try {
      profile = await window.ITBOY.api.getProfile(user.id);

      if (!profile.onboarded) {
        window.location.href = '../plans/';
        return;
      }

      if (greetingEl) {
        var displayName = (user.email || '').split('@')[0];
        greetingEl.textContent = 'Bonjour, ' + displayName + ' !';
      }

      habits = await window.ITBOY.api.getHabits(user.id, { archived: false });

      var allLogs = await window.ITBOY.api.getLogsForUser(user.id);
      logsByHabit = {};
      habits.forEach(function (h) { logsByHabit[h.id] = []; });
      allLogs.forEach(function (log) {
        if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = [];
        logsByHabit[log.habit_id].push(log.completed_date);
      });
      totalCheckins = allLogs.length;

      renderLimitNote();
      renderHabitList();
      renderTodayProgress();
      renderOverview();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
