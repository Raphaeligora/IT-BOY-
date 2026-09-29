/* IT BOY — Calcul du streak (fonction utilitaire pure, pas dans le
   composant d'affichage — cf. prompt-compte-tracker-itboy.md, section 4).
   N'a pas de rôle de sécurité (contrairement à la limite de plan) donc
   elle tourne côté front, sur les logs récupérés depuis Supabase. */

(function (global) {
  function toDate(dateStr) {
    var parts = dateStr.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function dateStr(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function diffDays(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  // 1-2-3. Streak actuel : part d'aujourd'hui (ou d'hier si pas encore
  // coché aujourd'hui) et remonte tant qu'il n'y a pas de trou.
  function computeCurrentStreak(completedDates, todayStr) {
    todayStr = todayStr || dateStr(new Date());
    var done = {};
    completedDates.forEach(function (d) { done[d] = true; });

    var cursor = toDate(todayStr);
    if (!done[todayStr]) {
      cursor.setDate(cursor.getDate() - 1);
    }

    var streak = 0;
    while (done[dateStr(cursor)]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // 4. Meilleur streak historique : la plus longue série consécutive
  // trouvée dans tout l'historique.
  function computeBestStreak(completedDates) {
    if (!completedDates.length) return 0;
    var sorted = Array.from(new Set(completedDates)).sort();
    var best = 1;
    var current = 1;
    for (var i = 1; i < sorted.length; i++) {
      var gap = diffDays(toDate(sorted[i]), toDate(sorted[i - 1]));
      current = gap === 1 ? current + 1 : 1;
      if (current > best) best = current;
    }
    return best;
  }

  // Taux de complétion sur N jours glissants (aujourd'hui inclus).
  function completionRate(completedDates, days, todayStr) {
    todayStr = todayStr || dateStr(new Date());
    if (days <= 0) return 0;
    var done = {};
    completedDates.forEach(function (d) { done[d] = true; });

    var cursor = toDate(todayStr);
    var count = 0;
    for (var i = 0; i < days; i++) {
      if (done[dateStr(cursor)]) count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return Math.round((count / days) * 100);
  }

  // --- Habitudes "X fois par semaine" (frequency === 'weekly') ---
  // Le streak quotidien (computeCurrentStreak) n'a pas de sens pour ces
  // habitudes : rater un jour n'est pas un echec si l'objectif de la
  // semaine est deja atteint. Les fonctions ci-dessous raisonnent en
  // semaines (lundi -> dimanche) plutot qu'en jours consecutifs.

  // Lundi de la semaine contenant dateStr, au format YYYY-MM-DD.
  function weekMonday(dStr) {
    var d = toDate(dStr);
    var dow = d.getDay(); // 0 = dim ... 6 = sam
    var offset = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - offset);
    return dateStr(d);
  }

  function completionsInWeek(completedDates, mondayStr) {
    var monday = toDate(mondayStr);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    var sundayStr = dateStr(sunday);
    return completedDates.filter(function (d) { return d >= mondayStr && d <= sundayStr; }).length;
  }

  // Nombre de coches sur la semaine en cours (lundi -> aujourd'hui).
  function completionsThisWeek(completedDates, todayStr) {
    todayStr = todayStr || dateStr(new Date());
    return completionsInWeek(completedDates, weekMonday(todayStr));
  }

  // Nombre de semaines consecutives (en remontant depuis la derniere
  // semaine terminee, ou la semaine en cours si l'objectif est deja
  // atteint) ou le nombre de coches >= target. Une semaine en cours
  // qui n'a pas encore atteint l'objectif n'est ni comptee ni cassante
  // (elle n'est pas terminee) : on l'ignore et on part de la semaine
  // precedente.
  function computeWeeklyStreak(completedDates, target, todayStr) {
    todayStr = todayStr || dateStr(new Date());
    target = target || 1;
    var today = toDate(todayStr);
    var weekFinished = today.getDay() === 0; // dimanche = derniere coche possible de la semaine
    var cursorMonday = weekMonday(todayStr);

    if (weekFinished && completionsInWeek(completedDates, cursorMonday) >= target) {
      // semaine en cours (terminee) comptee normalement, rien a faire
    } else {
      var m = toDate(cursorMonday);
      m.setDate(m.getDate() - 7);
      cursorMonday = dateStr(m);
    }

    var streak = 0;
    while (completionsInWeek(completedDates, cursorMonday) >= target) {
      streak += 1;
      var mm = toDate(cursorMonday);
      mm.setDate(mm.getDate() - 7);
      cursorMonday = dateStr(mm);
    }
    return streak;
  }

  // Meilleure serie de semaines consecutives >= target, sur tout l'historique.
  function computeBestWeeklyStreak(completedDates, target) {
    if (!completedDates.length) return 0;
    target = target || 1;
    var sorted = Array.from(new Set(completedDates)).sort();
    var cursor = toDate(weekMonday(sorted[0]));
    var end = toDate(weekMonday(sorted[sorted.length - 1]));
    var best = 0;
    var current = 0;
    while (cursor <= end) {
      var mStr = dateStr(cursor);
      if (completionsInWeek(completedDates, mStr) >= target) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
      cursor.setDate(cursor.getDate() + 7);
    }
    return best;
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.streak = {
    computeCurrentStreak: computeCurrentStreak,
    computeBestStreak: computeBestStreak,
    completionRate: completionRate,
    weekMonday: weekMonday,
    completionsInWeek: completionsInWeek,
    completionsThisWeek: completionsThisWeek,
    computeWeeklyStreak: computeWeeklyStreak,
    computeBestWeeklyStreak: computeBestWeeklyStreak,
    _dateStr: dateStr // exposé pour le calendrier heatmap
  };
})(window);
