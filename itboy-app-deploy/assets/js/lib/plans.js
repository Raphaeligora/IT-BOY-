/* IT BOY — Constantes des plans (contenu exact de prompt-compte-tracker-itboy.md, section 2).
   La vraie limite est appliquée en base (voir supabase/schema.sql,
   fonction enforce_habit_limit) — ces constantes ne servent qu'à
   l'affichage côté front (désactiver un bouton, afficher un message). */

(function (global) {
  var PLAN_LIMITS = { free: 3, premium: 10 };

  var PLANS = [
    {
      id: 'free',
      name: 'Free',
      price: '0€/mois',
      limit: 3,
      features: ['3 habitudes suivies', 'Historique jour par jour'],
      cta: 'Continuer avec Free'
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '4.99€/mois',
      limit: 10,
      features: ['10 habitudes suivies', 'Accès aux données complètes'],
      cta: 'Choisir Premium',
      highlighted: true
    }
  ];

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.PLAN_LIMITS = PLAN_LIMITS;
  global.ITBOY.PLANS = PLANS;
})(window);
