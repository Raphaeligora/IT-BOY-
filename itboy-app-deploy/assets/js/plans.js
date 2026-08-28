/* IT BOY — Ecran /plans */

(function () {
  var bannerZone = document.getElementById('banner-zone');
  var recapEl = document.getElementById('suggested-recap');
  var gridEl = document.getElementById('plans-grid');

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

        if (user) {
          try {
            await window.ITBOY.api.markOnboarded(user.id);
          } catch (e) {
            console.warn('[itboy] echec du marquage onboarded :', e);
          }
        }

        if (btn.getAttribute('data-plan') === 'premium') {
          window.location.href = '../checkout/';
        } else {
          window.location.href = '../dashboard/';
        }
      });
    });
  }

  async function renderSuggestedRecap(user) {
    try {
      var session = await window.ITBOY.api.getLatestQuizSessionForUser(user.id);
      var ids = (session && session.suggested_habit_ids) || [];
      if (!ids.length) { recapEl.style.display = 'none'; return; }

      var names = ids
        .map(function (id) {
          var h = window.ITBOY.HABIT_CATALOG.find(function (c) { return c.id === id; });
          return h ? h.name : null;
        })
        .filter(Boolean);

      recapEl.innerHTML = '<strong>Ton plan comprend :</strong><br />' + names.join(' · ');
    } catch (e) {
      recapEl.style.display = 'none';
    }
  }

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      renderPlans(null);
      recapEl.style.display = 'none';
      return;
    }

    var user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    renderPlans(user);
    renderSuggestedRecap(user);
  }

  init();
})();
