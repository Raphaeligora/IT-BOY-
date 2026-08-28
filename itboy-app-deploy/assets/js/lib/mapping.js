/* IT BOY — Mapping par règles (PAS d'appel IA)
   Fonction pure : (answers, catalog) -> habit[]
   Aucune dépendance au DOM, testable isolément.
   Logique exacte issue de prompt-quiz-itboy.md, section 3.

   NOTE : le spec prévoit que cette logique tourne côté backend. Le projet
   n'a pas encore de backend, donc elle vit ici en JS partagé, prête à être
   déplacée telle quelle vers une fonction serveur plus tard. */

(function (global) {
  var TEMPS_RANK = { court: 1, moyen: 2, long: 3 };

  var BONUS_RULES = {
    motivation: { habitId: 'mind-gratitude', category: 'mindset' },
    temps: { habitId: 'sante-eau', category: 'sante' },
    regularite: { habitId: 'prod-lit', category: 'productivite' },
    direction: { habitId: 'prod-planifier', category: 'productivite' }
  };

  // Habitudes par défaut si l'utilisateur clique "Passer"
  var DEFAULT_HABIT_IDS = ['prod-lit', 'sante-eau', 'mind-lecture', 'prod-planifier'];

  function computeRecommendedHabits(answers, catalog) {
    catalog = catalog || (global.ITBOY && global.ITBOY.HABIT_CATALOG) || [];

    // 1. Filtrer sur la catégorie principale
    var poolPrincipal = catalog.filter(function (h) { return h.category === answers.objectif; });

    // 2. Prioriser (filtrer) sur le temps disponible, avec repli si trop peu de résultats
    var byTemps = poolPrincipal.filter(function (h) {
      return TEMPS_RANK[h.temps] <= TEMPS_RANK[answers.temps];
    });
    if (byTemps.length < 3) byTemps = poolPrincipal;

    // 3. Prioriser (filtrer) sur le type, sauf si "mix" — même filet de sécurité que
    // l'étape 2 : si moins de 3 résultats après filtre, ne pas filtrer sur le type
    // (sinon certaines combinaisons, ex. santé + mental, ne laisseraient qu'1 habitude).
    var byType = byTemps;
    if (answers.type !== 'mix') {
      var filtered = byTemps.filter(function (h) { return h.type === answers.type; });
      if (filtered.length >= 3) byType = filtered;
    }

    // 4. Garder les 3-4 meilleures habitudes de pool_principal après filtres
    var mainHabits = byType.slice(0, Math.min(4, byType.length));

    // 5. Ajouter 1-2 habitudes bonus selon le blocage, en dehors de la catégorie principale
    var bonusRule = BONUS_RULES[answers.blocage];
    var finalHabits = mainHabits.slice();
    if (bonusRule) {
      var isAlreadySelected = finalHabits.some(function (h) { return h.id === bonusRule.habitId; });
      var bonusHabit = null;

      if (!isAlreadySelected) {
        bonusHabit = catalog.find(function (h) { return h.id === bonusRule.habitId; }) || null;
      } else {
        // Déjà présent : prendre la suivante de la même catégorie bonus
        bonusHabit = catalog.find(function (h) {
          return h.category === bonusRule.category &&
            !finalHabits.some(function (sel) { return sel.id === h.id; });
        }) || null;
      }

      if (bonusHabit) finalHabits.push(bonusHabit);
    }

    // 6. Dédupliquer en conservant l'ordre (pool_principal d'abord, puis bonus)
    var seen = {};
    var deduped = [];
    finalHabits.forEach(function (h) {
      if (!seen[h.id]) {
        seen[h.id] = true;
        deduped.push(h);
      }
    });

    return deduped;
  }

  function getDefaultHabits(catalog) {
    catalog = catalog || (global.ITBOY && global.ITBOY.HABIT_CATALOG) || [];
    return DEFAULT_HABIT_IDS
      .map(function (id) { return catalog.find(function (h) { return h.id === id; }); })
      .filter(Boolean);
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.computeRecommendedHabits = computeRecommendedHabits;
  global.ITBOY.getDefaultHabits = getDefaultHabits;
})(window);
