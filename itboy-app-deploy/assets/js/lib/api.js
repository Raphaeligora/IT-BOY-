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

   // Marque le profil comme "onboardé" (a vu /plans et choisi un plan).
   // Utilisé par /plans pour ne plus jamais renvoyer l'utilisateur vers
   // cet écran aux connexions suivantes (voir assets/js/plans.js).
   async function markOnboarded(userId) {
          var res = await db().from('profiles').update({ onboarded: true }).eq('id', userId);
          if (res.error) throw res.error;
   }

   async function getHabits(userId, opts) {
          opts = opts || {};
          var query = db().from('habits').select('*').eq('user_id', userId).order('position', { ascending: true });
          if (opts.archived === false || opts.archived === true) query = query.eq('archived', opts.archived);
          var res = await query;
          if (res.error) throw res.error;
          return res.data;
   }

   // Habitudes archivees (manuellement ou via le downgrade Premium->Free,
   // cf. enforce_plan_downgrade) - triees par date d'archivage/creation
   // la plus recente d'abord, "position" n'ayant plus de sens ici.
   async function getArchivedHabits(userId) {
          var res = await db().from('habits').select('*').eq('user_id', userId).eq('archived', true).order('created_at', { ascending: false });
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
                   source: habit.source || 'custom',
                   position: habit.position || 0
          }).select().single();
          if (res.error) throw res.error;
          return res.data;
   }

   async function archiveHabit(habitId) {
          var res = await db().from('habits').update({ archived: true }).eq('id', habitId);
          if (res.error) throw res.error;
   }

   // Reactive une habitude archivee. Le trigger enforce_habit_limit (voir
   // schema.sql) rejette en base si le plan free a deja 3 habitudes
   // actives - l'erreur Postgres brute remonte telle quelle a l'appelant,
   // meme mecanisme que createHabit.
   async function reactivateHabit(habitId, position) {
          var res = await db().from('habits').update({ archived: false, position: position || 0 }).eq('id', habitId);
          if (res.error) throw res.error;
   }

   // Tri manuel (glisser-deposer sur le dashboard) : persiste le nouvel
   // ordre. Une mise a jour par habitude - la liste est petite (limite
   // de plan ou confort d'usage en Premium), pas besoin de RPC batch.
   async function reorderHabits(orderedHabitIds) {
          for (var i = 0; i < orderedHabitIds.length; i++) {
                   var res = await db().from('habits').update({ position: i + 1 }).eq('id', orderedHabitIds[i]);
                   if (res.error) throw res.error;
          }
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

   // Enregistre/efface la note libre d'une coche existante (habit_logs.note).
   // Ne cree jamais de ligne : la coche doit deja exister (voir markDoneToday).
   async function updateLogNote(habitId, dateStr, note) {
          var res = await db().from('habit_logs').update({ note: note || null }).eq('habit_id', habitId).eq('completed_date', dateStr);
          if (res.error) throw res.error;
   }

   // Streak freeze : protege un jour manque en inserant une coche
   // source='freeze' (comptee par le calcul de streak, cf. streak.js,
   // mais distinguee visuellement et non comptee comme une vraie coche
   // dans les celebrations/exports). Un seul jeton par jour utilise -
   // le trigger unique(habit_id, completed_date) empeche un doublon si
   // le jour est deja coche.
   async function freezeDay(userId, habitId, dateStr) {
          var res = await db().from('habit_logs').insert({
                   user_id: userId,
                   habit_id: habitId,
                   completed_date: dateStr,
                   source: 'freeze'
          });
          if (res.error) throw res.error;
   }

   // Nombre de freezes deja utilises ce mois-ci (tous logs confondus,
   // toutes habitudes) - sert a plafonner selon le plan (voir
   // FREEZE_LIMITS dans dashboard.js).
   async function getFreezeCountThisMonth(userId) {
          var now = new Date();
          var pad = function (n) { return String(n).padStart(2, '0'); };
          var firstOfMonth = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-01';
          var res = await db().from('habit_logs').select('id', { count: 'exact', head: true })
                   .eq('user_id', userId).eq('source', 'freeze').gte('completed_date', firstOfMonth);
          if (res.error) throw res.error;
          return res.count || 0;
   }

   global.ITBOY = global.ITBOY || {};
     global.ITBOY.api = {
            todayStr: todayStr,
            getProfile: getProfile,
            markOnboarded: markOnboarded,
            getHabits: getHabits,
            getArchivedHabits: getArchivedHabits,
            getHabit: getHabit,
            createHabit: createHabit,
            archiveHabit: archiveHabit,
            reactivateHabit: reactivateHabit,
            reorderHabits: reorderHabits,
            getLogs: getLogs,
            getLogsForUser: getLogsForUser,
            markDoneToday: markDoneToday,
            unmarkDoneToday: unmarkDoneToday,
            updateLogNote: updateLogNote,
            freezeDay: freezeDay,
            getFreezeCountThisMonth: getFreezeCountThisMonth
     };
})(window);
