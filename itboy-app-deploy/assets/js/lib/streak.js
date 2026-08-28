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

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.streak = {
    computeCurrentStreak: computeCurrentStreak,
    computeBestStreak: computeBestStreak,
    completionRate: completionRate,
    _dateStr: dateStr // exposé pour le calendrier heatmap
  };
})(window);
