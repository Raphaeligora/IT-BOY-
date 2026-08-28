/* IT BOY — Persistance de la session de quiz
   Les réponses sont stockées en localStorage le temps du parcours. Une
   fois les 5 questions répondues, `saveQuizSession` les envoie à la
   table Supabase `quiz_sessions` (id généré côté client, gardé en
   localStorage pour pouvoir relier la session au compte à l'inscription
   — voir assets/js/signup.js). Si Supabase n'est pas configuré, la
   fonction se contente d'un log console (le quiz reste utilisable en
   local sans backend). */

(function (global) {
  var ANSWERS_KEY = 'itboy_quiz_answers';
  var SESSION_ID_KEY = 'itboy_quiz_session_id';

  function getAnswers() {
    try {
      var raw = localStorage.getItem(ANSWERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveAnswers(answers) {
    try {
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    } catch (e) { /* localStorage indisponible (mode privé…) : on ignore */ }
  }

  function clearAnswers() {
    try { localStorage.removeItem(ANSWERS_KEY); } catch (e) {}
  }

  function getSessionId() {
    try { return localStorage.getItem(SESSION_ID_KEY); } catch (e) { return null; }
  }

  function setSessionId(id) {
    try { localStorage.setItem(SESSION_ID_KEY, id); } catch (e) {}
  }

  function clearSessionId() {
    try { localStorage.removeItem(SESSION_ID_KEY); } catch (e) {}
  }

  async function saveQuizSession(answers, suggestedHabitIds, skipped) {
    var payload = {
      answers: answers,
      suggested_habit_ids: suggestedHabitIds,
      skipped: !!skipped,
      created_at: new Date().toISOString()
    };

    if (!global.ITBOY.isSupabaseConfigured || !global.ITBOY.supabase) {
      console.info('[itboy] quiz_session (Supabase non configuré, non envoyé) :', payload);
      return;
    }

    try {
      var id = (global.crypto && global.crypto.randomUUID) ? global.crypto.randomUUID() : null;
      var row = {
        answers: answers,
        suggested_habit_ids: suggestedHabitIds,
        skipped: !!skipped
      };
      if (id) row.id = id;

      var res = await global.ITBOY.supabase.from('quiz_sessions').insert(row).select().single();
      if (res.error) throw res.error;

      setSessionId(res.data.id);
    } catch (e) {
      console.error('[itboy] échec de l\'enregistrement de quiz_session :', e);
    }
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.storage = {
    getAnswers: getAnswers,
    saveAnswers: saveAnswers,
    clearAnswers: clearAnswers,
    getSessionId: getSessionId,
    setSessionId: setSessionId,
    clearSessionId: clearSessionId,
    saveQuizSession: saveQuizSession
  };
})(window);
