/* IT BOY — Logique d'affichage du quiz (5 questions, une par écran).
   Contenu exact des questions : prompt-quiz-itboy.md, section 1. */

(function () {
  var QUESTIONS = [
    {
      id: 'objectif',
      title: 'Quel est ton objectif principal ?',
      options: [
        { value: 'sante', label: 'Santé' },
        { value: 'productivite', label: 'Productivité' },
        { value: 'mindset', label: 'Mindset & discipline' },
        { value: 'finance', label: 'Finances' }
      ]
    },
    {
      id: 'temps',
      title: 'Combien de temps peux-tu consacrer chaque jour ?',
      options: [
        { value: 'court', label: 'Moins de 15 minutes' },
        { value: 'moyen', label: '15 à 30 minutes' },
        { value: 'long', label: 'Plus de 30 minutes' }
      ]
    },
    {
      id: 'blocage',
      title: 'Qu\'est-ce qui te freine le plus aujourd\'hui ?',
      options: [
        { value: 'motivation', label: 'Le manque de motivation' },
        { value: 'temps', label: 'Le manque de temps' },
        { value: 'regularite', label: 'Le manque de régularité' },
        { value: 'direction', label: 'Je ne sais pas par où commencer' }
      ]
    },
    {
      id: 'type',
      title: 'Tu préfères des habitudes plutôt...',
      options: [
        { value: 'physique', label: 'Physiques' },
        { value: 'mental', label: 'Mentales' },
        { value: 'mix', label: 'Un mix des deux' }
      ]
    },
    {
      id: 'moment',
      title: 'À quel moment de la journée es-tu le plus discipliné ?',
      options: [
        { value: 'matin', label: 'Le matin' },
        { value: 'soir', label: 'Le soir' },
        { value: 'variable', label: 'Ça varie' }
      ]
    }
  ];

  var current = 0;
  var answers = window.ITBOY.storage.getAnswers();

  var cardEl = document.getElementById('question-card');
  var fillEl = document.getElementById('progress-fill');
  var textEl = document.getElementById('progress-text');
  var skipBtn = document.getElementById('skip-btn');

  function render() {
    var q = QUESTIONS[current];
    fillEl.style.width = (((current) / QUESTIONS.length) * 100 + (100 / QUESTIONS.length)) + '%';
    textEl.textContent = 'Question ' + (current + 1) + '/' + QUESTIONS.length;

    var html = '<h2 class="question-title font-cinzel">' + q.title + '</h2>';
    html += '<div class="options-list">';
    q.options.forEach(function (opt) {
      var selected = answers[q.id] === opt.value ? ' selected' : '';
      html += '<button type="button" class="option-btn' + selected + '" data-value="' + opt.value + '">' + opt.label + '</button>';
    });
    html += '</div>';
    cardEl.innerHTML = html;

    Array.prototype.forEach.call(cardEl.querySelectorAll('.option-btn'), function (btn) {
      btn.addEventListener('click', function () {
        answers[q.id] = btn.getAttribute('data-value');
        window.ITBOY.storage.saveAnswers(answers);
        goNext();
      });
    });
  }

  function goNext() {
    if (current < QUESTIONS.length - 1) {
      current += 1;
      render();
    } else {
      finish(false);
    }
  }

  async function finish(skipped) {
    var suggested;
    if (skipped) {
      suggested = window.ITBOY.getDefaultHabits();
    } else {
      suggested = window.ITBOY.computeRecommendedHabits(answers, window.ITBOY.HABIT_CATALOG);
    }
    var suggestedIds = suggested.map(function (h) { return h.id; });

    // On attend l'envoi à Supabase avant de naviguer, sinon la requête
    // risque d'être annulée par le changement de page.
    await window.ITBOY.storage.saveQuizSession(answers, suggestedIds, skipped);

    var payload = { answers: answers, suggestedHabitIds: suggestedIds, skipped: !!skipped };
    try { sessionStorage.setItem('itboy_quiz_result', JSON.stringify(payload)); } catch (e) {}

    window.location.href = 'resultat/';
  }

  skipBtn.addEventListener('click', function () {
    finish(true);
  });

  render();
})();
