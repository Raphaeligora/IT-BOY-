/* IT BOY — Accès aux données (Supabase). Chaque fonction lève l'erreur
   Supabase telle quelle (ex: la limite de plan renvoyée par le trigger
   en base) pour que l'appelant l'affiche à l'utilisateur. */

(function (global) {
  function db() { return global.ITBOY.supabase; }

  function todayStr() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  async function getProfile(userId) {
    var res = await db().from('profiles').select('*').eq('id', userId).single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function getQuizSession(sessionId) {
    if (!sessionId) return null;
    var res = await db().from('quiz_sessions').select('*').eq('id', sessionId).maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }

  async function getLatestQuizSessionForUser(userId) {
    var res = await db().from('quiz_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }

  async function linkQuizSessionToUser(sessionId, userId) {
    if (!sessionId) return;
    var res = await db().from('quiz_sessions').update({ user_id: userId }).eq('id', sessionId);
    if (res.error) throw res.error;
  }

  async function getHabits(userId, opts) {
    opts = opts || {};
    var query = db().from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (opts.archived === false) query = query.eq('archived', false);
    var res = await query;
    if (res.error) throw res.error;
    return res.data;
  }

  async function getHabit(habitId) {
    var res = await db().from('habits').select('*').eq('id', habitId).single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function createHabit(userId, habit) {
    var res = await db().from('habits').insert({
      user_id: userId,
      name: habit.name,
      category: habit.category,
      frequency: habit.frequency || 'daily',
      frequency_per_week: habit.frequencyPerWeek || null,
      archived: false,
      source: habit.source || 'custom'
    }).select().single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function archiveHabit(habitId) {
    var res = await db().from('habits').update({ archived: true }).eq('id', habitId);
    if (res.error) throw res.error;
  }

  async function getLogs(habitId) {
    var res = await db().from('habit_logs').select('*').eq('habit_id', habitId).order('completed_date', { ascending: false });
    if (res.error) throw res.error;
    return res.data;
  }

  async function getLogsForUser(userId) {
    var res = await db().from('habit_logs').select('*').eq('user_id', userId);
    if (res.error) throw res.error;
    return res.data;
  }

  async function markDoneToday(userId, habitId) {
    var res = await db().from('habit_logs').insert({
      user_id: userId,
      habit_id: habitId,
      completed_date: todayStr()
    });
    if (res.error) throw res.error;
  }

  async function unmarkDoneToday(habitId) {
    var res = await db().from('habit_logs').delete().eq('habit_id', habitId).eq('completed_date', todayStr());
    if (res.error) throw res.error;
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.api = {
    todayStr: todayStr,
    getProfile: getProfile,
    getQuizSession: getQuizSession,
    getLatestQuizSessionForUser: getLatestQuizSessionForUser,
    linkQuizSessionToUser: linkQuizSessionToUser,
    getHabits: getHabits,
    getHabit: getHabit,
    createHabit: createHabit,
    archiveHabit: archiveHabit,
    getLogs: getLogs,
    getLogsForUser: getLogsForUser,
    markDoneToday: markDoneToday,
    unmarkDoneToday: unmarkDoneToday
  };
})(window);
