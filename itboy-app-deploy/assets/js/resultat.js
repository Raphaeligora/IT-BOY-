/* IT BOY — Écran résultat (/quiz/resultat/)
   Affiche les habitudes calculées par la session en cours (sessionStorage),
   ou les recalcule à partir des réponses en localStorage si l'utilisateur
   arrive directement sur cette page (rechargement, retour navigateur). */

(function () {
  var gridEl = document.getElementById('habit-grid');

  function loadResult() {
    try {
      var raw = sessionStorage.getItem('itboy_quiz_result');
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    // Repli : pas de résultat en session (arrivée directe sur la page) —
    // on recalcule à partir des réponses stockées, si présentes.
    var answers = window.ITBOY.storage.getAnswers();
    if (!answers || !answers.objectif) return null;

    var suggested = window.ITBOY.computeRecommendedHabits(answers, window.ITBOY.HABIT_CATALOG);
    return { answers: answers, suggestedHabitIds: suggested.map(function (h) { return h.id; }), skipped: false };
  }

  function render() {
    var result = loadResult();

    if (!result || !result.suggestedHabitIds || !result.suggestedHabitIds.length) {
      gridEl.innerHTML = '<p style="color:#8A8A8A;font-size:14px;text-align:center">' +
        'Aucune réponse trouvée. <a href="../">Recommencer le quiz</a>.</p>';
      return;
    }

    var catalog = window.ITBOY.HABIT_CATALOG;
    var labels = window.ITBOY.CATEGORY_LABELS;

    var habits = result.suggestedHabitIds
      .map(function (id) { return catalog.find(function (h) { return h.id === id; }); })
      .filter(Boolean);

    gridEl.innerHTML = habits.map(function (h) {
      return '<div class="habit-card">' +
        '<span class="category">' + labels[h.category] + '</span>' +
        '<span class="name">' + h.name + '</span>' +
        '</div>';
    }).join('');
  }

  render();
})();
