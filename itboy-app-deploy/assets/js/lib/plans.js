/* IT BOY — Constantes des plans (mise à jour 2026-09-28 : Premium passe
   à illimité, plus de plafond à 10). La vraie limite est appliquée en
   base (voir supabase/schema.sql, fonction enforce_habit_limit) — ces
   constantes ne servent qu'à l'affichage côté front (désactiver un
   bouton, afficher un message). Free reste borné à 30 jours
   d'historique affiché (voir habitDetail.js) — un plafond d'affichage,
   pas une limite de sécurité, donc pas répliqué ici. */

(function (global) {
  // Pas de vraie infinité en JS pour un affichage/comparaison simple :
  // un plafond volontairement absurde qu'aucun humain n'atteindra.
  var PLAN_LIMITS = { free: 3, premium: 999999 };

  // Streak freeze (2026-09-29) : jetons mensuels qui protegent un jour
  // manque sans casser le streak (voir dashboard.js). Verifie cote
  // front uniquement - confort de motivation, pas une regle de securite.
  var FREEZE_LIMITS = { free: 1, premium: 4 };

  var PLANS = [
    {
      id: 'free',
      name: 'Free',
      price: '0€/mois',
      limit: 3,
      features: ['3 habitudes suivies', 'Historique 30 jours'],
      cta: 'Continuer avec Free'
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '4,99€/mois',
      limit: PLAN_LIMITS.premium,
      features: ['Habitudes illimitées', 'Historique complet', 'Statistiques détaillées'],
      cta: 'Choisir Premium',
      highlighted: true
    }
  ];

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.PLAN_LIMITS = PLAN_LIMITS;
  global.ITBOY.FREEZE_LIMITS = FREEZE_LIMITS;
  global.ITBOY.PLANS = PLANS;
})(window);
