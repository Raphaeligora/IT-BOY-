/* IT BOY - Ecran /dashboard (tracker principal)
   La limite de plan affichee/desactivee ici est un confort d'UI : la
   verite est appliquee en base par le trigger `enforce_habit_limit`
   (voir supabase/schema.sql) - un rejet serveur est toujours possible
   et affiche tel quel (course entre deux onglets, etc.). */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var limitNoteEl = document.getElementById('plan-limit-note');
  var suggestionsSection = document.getElementById('suggestions-section');
  var listEl = document.getElementById('habit-list');
  var addToggleBtn = document.getElementById('add-habit-toggle');
  var addForm = document.getElementById('add-habit-form');
  var frequencySelect = document.getElementById('frequency-select');
  var frequencyCountLabel = document.getElementById('frequency-count-label');

  var user = null;
  var profile = null;
  var habits = [];      // habitudes actives
  var logsByHabit = {};  // habitId -> [completed_date, ...]
  var todayStr = window.ITBOY.api.todayStr();

  function planLimit() {
    return window.ITBOY.PLAN_LIMITS[profile.plan] || 3;
  }

  function renderLimitNote() {
    limitNoteEl.textContent = habits.length + '/' + planLimit() + ' habitudes actives - plan ' +
      (profile.plan === 'premium' ? 'Premium' : 'Free') + '.';
  }

  async function renderSuggestions() {
    var session;
    try {
      session = await window.ITBOY.api.getLatestQuizSessionForUser(user.id);
    } catch (e) {
      suggestionsSection.innerHTML = '';
      return;
    }

    var suggestedIds = (session && session.suggested_habit_ids) || [];
    if (!suggestedIds.length) { suggestionsSection.innerHTML = ''; return; }

    var existingNames = {};
    habits.forEach(function (h) { existingNames[h.name] = true; });

    var pending = suggestedIds
      .map(function (id) { return window.ITBOY.HABIT_CATALOG.find(function (h) { return h.id === id; }); })
      .filter(function (h) { return h && !existingNames[h.name]; });

    if (!pending.length) { suggestionsSection.innerHTML = ''; return; }

    var atLimit = habits.length >= planLimit();

    suggestionsSection.innerHTML =
      '<div class="section-heading">Suggestions de ton quiz</div>' +
      '<div class="habit-list">' +
      pending.map(function (h) {
        return '<div class="suggestion-row">' +
          '<div class="info">' +
          '<span class="name">' + window.ITBOY.ui.escapeHtml(h.name) + '</span>' +
          '<span class="category">' + window.ITBOY.CATEGORY_LABELS[h.category] + '</span>' +
          '</div>' +
          '<button class="activate-btn" data-name="' + window.ITBOY.ui.escapeHtml(h.name) + '" ' +
          'data-category="' + h.category + '"' + (atLimit ? ' disabled' : '') + '>Activer</button>' +
          '</div>';
      }).join('') +
      '</div>' +
      (atLimit ? '<p class="plan-limit-note">Limite de ' + planLimit() + ' habitudes atteinte pour ton plan.</p>' : '');

    suggestionsSection.querySelectorAll('.activate-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateHabit(btn.getAttribute('data-name'), btn.getAttribute('data-category'), 'quiz');
      });
    });
  }

  async function activateHabit(name, category, source) {
    bannerZone.innerHTML = '';
    try {
      var habit = await window.ITBOY.api.createHabit(user.id, { name: name, category: category, source: source });
      habits.push(habit);
      logsByHabit[habit.id] = [];
      renderLimitNote();
      renderHabitList();
      await renderSuggestions();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  function renderHabitList() {
    if (!habits.length) {
      listEl.innerHTML = '<p class="page-subtitle" style="margin:0">Aucune habitude active pour l\'instant.</p>';
      return;
    }

    listEl.innerHTML = habits.map(function (h) {
      var dates = logsByHabit[h.id] || [];
      var doneToday = dates.indexOf(todayStr) !== -1;
      var streak = window.ITBOY.streak.computeCurrentStreak(dates, todayStr);
      return '<div class="habit-row" data-habit-id="' + h.id + '">' +
        '<button class="habit-checkbox' + (doneToday ? ' done' : '') + '" data-action="toggle" aria-label="Fait aujourd\'hui"></button>' +
        '<div class="info">' +
        '<span class="name">' + window.ITBOY.ui.escapeHtml(h.name) + '</span>' +
        '<span class="category">' + (window.ITBOY.CATEGORY_LABELS[h.category] || h.category) + '</span>' +
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
  }

  async function toggleToday(habitId) {
    bannerZone.innerHTML = '';
    var dates = logsByHabit[habitId] || [];
    var doneToday = dates.indexOf(todayStr) !== -1;

    try {
      if (doneToday) {
        await window.ITBOY.api.unmarkDoneToday(habitId);
        logsByHabit[habitId] = dates.filter(function (d) { return d !== todayStr; });
      } else {
        await window.ITBOY.api.markDoneToday(user.id, habitId);
        logsByHabit[habitId] = dates.concat([todayStr]);
      }
      renderHabitList();
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
      await renderSuggestions();
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
      var habit = await window.ITBOY.api.createHabit(user.id, {
        name: name, category: category, frequency: frequency,
        frequencyPerWeek: frequencyPerWeek, source: 'custom'
      });
      habits.push(habit);
      logsByHabit[habit.id] = [];
      addForm.reset();
      addForm.style.display = 'none';
      renderLimitNote();
      renderHabitList();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    window.ITBOY.auth.signOut();
  });

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      return;
    }

    user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    try {
      profile = await window.ITBOY.api.getProfile(user.id);

      if (!profile.onboarded) {
        window.location.href = '../plans/';
        return;
      }

      habits = await window.ITBOY.api.getHabits(user.id, { archived: false });

      var allLogs = await window.ITBOY.api.getLogsForUser(user.id);
      logsByHabit = {};
      habits.forEach(function (h) { logsByHabit[h.id] = []; });
      allLogs.forEach(function (log) {
        if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = [];
        logsByHabit[log.habit_id].push(log.completed_date);
      });

      renderLimitNote();
      renderHabitList();
      await renderSuggestions();
    } catch (err) {
      window.ITBOY.ui.showError(bannerZone, err);
    }
  }

  init();
})();
