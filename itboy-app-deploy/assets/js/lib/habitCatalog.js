/* IT BOY — Catalogue d'habitudes
   Contenu exact issu de prompt-quiz-itboy.md, section 2.

   NOTE : le spec prévoit à terme une vraie table `habit_catalog` en base
   (pour l'enrichir sans redéployer). Ce fichier reste pour l'instant la
   source de vérité côté front car le projet n'a pas encore de backend —
   il est structuré pour être copié tel quel dans une table le moment venu. */

(function (global) {
  var HABIT_CATALOG = [
    // SANTÉ
    { id: 'sante-eau', name: 'Boire 2L d\'eau par jour', category: 'sante', type: 'mental', temps: 'court' },
    { id: 'sante-marche', name: '20 minutes de marche ou de sport', category: 'sante', type: 'physique', temps: 'moyen' },
    { id: 'sante-sommeil', name: 'Se coucher avant 23h', category: 'sante', type: 'physique', temps: 'court' },
    { id: 'sante-etirements', name: 'Étirements ou mobilité (10 min)', category: 'sante', type: 'physique', temps: 'court' },
    { id: 'sante-repas', name: 'Préparer un repas sain fait maison', category: 'sante', type: 'physique', temps: 'long' },

    // PRODUCTIVITÉ
    { id: 'prod-planifier', name: 'Planifier sa journée le matin (5 min)', category: 'productivite', type: 'mental', temps: 'court' },
    { id: 'prod-priorite', name: 'Une tâche prioritaire avant midi', category: 'productivite', type: 'mental', temps: 'moyen' },
    { id: 'prod-pause', name: 'Une pause écran toutes les 90 minutes', category: 'productivite', type: 'mental', temps: 'court' },
    { id: 'prod-lit', name: 'Faire son lit en se levant', category: 'productivite', type: 'physique', temps: 'court' },
    { id: 'prod-bilan', name: 'Bilan de la semaine chaque dimanche soir', category: 'productivite', type: 'mental', temps: 'moyen' },

    // MINDSET & DISCIPLINE
    { id: 'mind-lecture', name: '10 minutes de lecture', category: 'mindset', type: 'mental', temps: 'court' },
    { id: 'mind-meditation', name: 'Méditation ou respiration (5-10 min)', category: 'mindset', type: 'mental', temps: 'court' },
    { id: 'mind-gratitude', name: 'Noter 3 choses accomplies dans la journée', category: 'mindset', type: 'mental', temps: 'court' },
    { id: 'mind-zone', name: 'Une action hors de sa zone de confort/semaine', category: 'mindset', type: 'mental', temps: 'long' },
    { id: 'mind-reseaux', name: 'Pas de réseaux sociaux la première heure', category: 'mindset', type: 'mental', temps: 'moyen' },

    // FINANCES
    { id: 'fin-depenses', name: 'Noter toutes ses dépenses du jour', category: 'finance', type: 'mental', temps: 'court' },
    { id: 'fin-epargne', name: 'Mettre un montant fixe de côté chaque semaine', category: 'finance', type: 'mental', temps: 'moyen' },
    { id: 'fin-contenu', name: '10 minutes de contenu sur les finances', category: 'finance', type: 'mental', temps: 'court' },
    { id: 'fin-budget', name: 'Vérifier son budget une fois par semaine', category: 'finance', type: 'mental', temps: 'moyen' },
    { id: 'fin-impulsif', name: 'Attendre 24h avant tout achat impulsif', category: 'finance', type: 'mental', temps: 'long' }
  ];

  var CATEGORY_LABELS = {
    sante: 'Santé',
    productivite: 'Productivité',
    mindset: 'Mindset & discipline',
    finance: 'Finances'
  };

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.HABIT_CATALOG = HABIT_CATALOG;
  global.ITBOY.CATEGORY_LABELS = CATEGORY_LABELS;
})(window);
