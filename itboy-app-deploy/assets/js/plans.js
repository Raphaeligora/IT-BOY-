/* IT BOY — Ecran /plans */

(function () {
  var bannerZone = document.getElementById('banner-zone');
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
        var chosenPlan = btn.getAttribute('data-plan');

        if (user) {
          try {
            await window.ITBOY.api.markOnboarded(user.id);
          } catch (e) {
            console.warn('[itboy] echec du marquage onboarded :', e);
          }
        }

        window.ITBOY.track('plan_chosen', { plan: chosenPlan });

        if (chosenPlan === 'premium') {
          window.location.href = '../checkout/';
        } else {
          window.location.href = '../dashboard/';
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
