/* IT BOY — Ecran /plans */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var gridEl = document.getElementById('plans-grid');
  var onboardingZone = document.getElementById('onboarding-zone');
  var ONBOARDING_MAX = 3; // aligné sur la limite Free - le compte n'est
  // pas encore Premium a cet instant (webhook Stripe pas encore passé
  // pour qui choisit Premium), donc rester sous cette limite evite tout
  // rejet du trigger enforce_habit_limit ici.

  function goNext(chosenPlan) {
    if (chosenPlan === 'premium') {
      window.location.href = '../checkout/';
    } else {
      window.location.href = '../dashboard/';
    }
  }

  // Étape "premières habitudes" affichée après le choix du plan, avant
  // de continuer vers checkout/dashboard - un dashboard vide au premier
  // login est un mauvais départ, mieux vaut proposer un point de départ
  // concret (facultatif, on peut "Passer").
  function renderOnboarding(user, chosenPlan) {
    if (!onboardingZone || !window.ITBOY.HABIT_CATALOG) { goNext(chosenPlan); return; }

    gridEl.style.display = 'none';
    onboardingZone.style.display = '';

    var selected = [];

    var groups = {};
    window.ITBOY.HABIT_CATALOG.forEach(function (h) {
      groups[h.category] = groups[h.category] || [];
      groups[h.category].push(h);
    });

    function renderChips() {
      var atMax = selected.length >= ONBOARDING_MAX;
      var html = '<h2 class="page-title font-cinzel" style="font-size:22px;margin:0 0 6px">Choisis tes premières habitudes</h2>' +
        '<p class="page-subtitle" style="margin-bottom:8px">Jusqu\'à ' + ONBOARDING_MAX + ' pour démarrer — tu pourras en ajouter d\'autres ensuite.</p>';

      Object.keys(window.ITBOY.CATEGORY_LABELS).forEach(function (cat) {
        if (!groups[cat]) return;
        html += '<p class="detailed-stats-heading" style="margin:20px 0 10px">' + window.ITBOY.CATEGORY_LABELS[cat] + '</p>' +
          '<div class="select-chip-row">' + groups[cat].map(function (h) {
            var active = selected.indexOf(h.id) !== -1;
            var disabled = !active && atMax;
            return '<button type="button" class="select-chip' + (active ? ' active' : '') + '"' +
              (disabled ? ' disabled' : '') + ' data-id="' + h.id + '">' + window.ITBOY.ui.escapeHtml(h.name) + '</button>';
          }).join('') + '</div>';
      });

      html += '<p class="select-chip-note">' + selected.length + '/' + ONBOARDING_MAX + ' sélectionnée' + (selected.length > 1 ? 's' : '') + '.</p>' +
        '<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">' +
        '<button class="cta-btn" id="onboarding-continue" type="button">Continuer</button>' +
        '<button class="cta-btn ghost" id="onboarding-skip" type="button">Passer pour l\'instant</button>' +
        '</div>';

      onboardingZone.innerHTML = html;

      onboardingZone.querySelectorAll('[data-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var idx = selected.indexOf(id);
          if (idx !== -1) selected.splice(idx, 1);
          else if (selected.length < ONBOARDING_MAX) selected.push(id);
          renderChips();
        });
      });
      document.getElementById('onboarding-continue').addEventListener('click', function () { finish(false); });
      document.getElementById('onboarding-skip').addEventListener('click', function () { finish(true); });
    }

    async function finish(skip) {
      var continueBtn = document.getElementById('onboarding-continue');
      var skipBtn = document.getElementById('onboarding-skip');
      if (continueBtn) continueBtn.disabled = true;
      if (skipBtn) skipBtn.disabled = true;

      if (!skip && selected.length) {
        try {
          for (var i = 0; i < selected.length; i++) {
            var catalogHabit = window.ITBOY.HABIT_CATALOG.find(function (h) { return h.id === selected[i]; });
            if (!catalogHabit) continue;
            await window.ITBOY.api.createHabit(user.id, {
              name: catalogHabit.name,
              category: catalogHabit.category,
              frequency: 'daily',
              source: 'quiz',
              position: i + 1
            });
          }
          window.ITBOY.track('first_habit_created', { source: 'onboarding', count: selected.length });
        } catch (err) {
          window.ITBOY.ui.showError(bannerZone, err);
          if (continueBtn) continueBtn.disabled = false;
          if (skipBtn) skipBtn.disabled = false;
          return;
        }
      }

      goNext(chosenPlan);
    }

    renderChips();
  }

  function renderPlans(user) {
    gridEl.innerHTML = window.ITBOY.PLANS.map(function (plan) {
      var cls = 'plan-card' + (plan.highlighted ? ' highlighted' : '');
      var features = plan.features.map(function (f) { return '<li>' + f + '</li>'; }).join('');
      return '<div class="' + cls + '">' +
        '<div class="plan-name font-cinzel">' + plan.name + '</div>' +
        '<div class="plan-price">' + plan.price + '</div>' +
        '<ul>' + features + '</ul>' +
        '<button class="cta-btn" data-plan="' + plan.id + '">' + plan.cta + '</button>' +
        '</div>';
    }).join('');

    gridEl.querySelectorAll('button[data-plan]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        var chosenPlan = btn.getAttribute('data-plan');

        if (user) {
          try {
            await window.ITBOY.api.markOnboarded(user.id);
          } catch (e) {
            console.warn('[itboy] echec du marquage onboarded :', e);
          }
        }

        window.ITBOY.track('plan_chosen', { plan: chosenPlan });

        if (user) {
          renderOnboarding(user, chosenPlan);
        } else {
          goNext(chosenPlan);
        }
      });
    });
  }

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      renderPlans(null);
      return;
    }

    var user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    renderPlans(user);
  }

  init();
})();
