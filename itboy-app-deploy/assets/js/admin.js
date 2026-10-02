/* IT BOY — Dashboard interne (/admin/), reserve au proprietaire du
   produit (verifie par email cote client ET cote base : la policy RLS
   "events_select_owner" sur `events`, voir supabase/schema.sql section
   11, est ce qui empeche reellement un autre compte de lire ces
   donnees — la verification ici n'est qu'un redirect de confort, pas
   une barriere de securite en soi).

   Agrege les evenements de la table `events` (page_view + clics
   data-track, voir assets/js/lib/track.js) entierement cote client :
   pas de vue/RPC SQL dediee, le volume reste faible pour un produit
   solo et ca evite une migration SQL supplementaire pour un simple
   dashboard de lecture. */

(function () {
  var OWNER_EMAIL = 'raphaeligora@gmail.com';
  var bannerZone = document.getElementById('banner-zone');
  var zone = document.getElementById('admin-zone');
  var logoutBtn = document.getElementById('logout-btn');
  var dailyChart = null;

  if (logoutBtn) logoutBtn.addEventListener('click', function () { window.ITBOY.auth.signOut(); });

  function dayKey(iso) { return iso.slice(0, 10); }

  function last14Days() {
    var days = [];
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    for (var i = 13; i >= 0; i--) {
      var day = new Date(d);
      day.setDate(day.getDate() - i);
      days.push(day.toISOString().slice(0, 10));
    }
    return days;
  }

  function countSince(events, hours) {
    var since = Date.now() - hours * 3600 * 1000;
    return events.filter(function (e) { return new Date(e.created_at).getTime() >= since; }).length;
  }

  function topEntries(counts, limit) {
    return Object.keys(counts)
      .map(function (k) { return { key: k, count: counts[k] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, limit || 10);
  }

  function renderTopList(title, entries, emptyLabel) {
    if (!entries.length) {
      return '<div class="chart-card"><div class="chart-head"><span class="chart-title">' + title + '</span></div>' +
        '<p class="empty-state" style="padding:20px 0">' + emptyLabel + '</p></div>';
    }
    var max = entries[0].count || 1;
    return '<div class="chart-card"><div class="chart-head"><span class="chart-title">' + title + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      entries.map(function (e) {
        var pct = Math.max(6, Math.round((e.count / max) * 100));
        return '<div>' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">' +
          '<span style="color:var(--white)">' + window.ITBOY.ui.escapeHtml(e.key) + '</span>' +
          '<span class="link-muted">' + e.count + '</span>' +
          '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '</div>';
      }).join('') +
      '</div></div>';
  }

  async function init() {
    if (!window.ITBOY.isSupabaseConfigured) {
      window.ITBOY.ui.showConfigBanner(bannerZone);
      return;
    }

    var user = await window.ITBOY.auth.requireUser('../login/');
    if (!user) return;

    if ((user.email || '').toLowerCase() !== OWNER_EMAIL) {
      window.location.href = '../dashboard/';
      return;
    }

    window.ITBOY.ui.showLoading(zone);

    var results = await Promise.all([
      window.ITBOY.supabase
        .from('events')
        .select('name, meta, anon_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5000),
      // profiles_select_owner (voir supabase/schema.sql section 12) est ce
      // qui permet de lire TOUS les profils ici, pas seulement le sien.
      window.ITBOY.supabase
        .from('profiles')
        .select('email, plan, created_at')
        .order('created_at', { ascending: false })
        .limit(2000)
    ]);
    var res = results[0];
    var profilesRes = results[1];

    if (res.error) {
      window.ITBOY.ui.showError(bannerZone, res.error);
      zone.innerHTML = '';
      return;
    }
    // La policy profiles_select_owner peut ne pas encore avoir ete appliquee
    // (migration a executer manuellement, voir schema.sql section 12) : on
    // ne bloque pas tout le dashboard pour autant, la section inscriptions
    // sera juste vide avec un message d'erreur dedie.
    var profiles = profilesRes.error ? [] : (profilesRes.data || []);

    var events = res.data || [];
    var pageViews = events.filter(function (e) { return e.name === 'page_view'; });
    var clicks = events.filter(function (e) { return e.name !== 'page_view'; });

    var uniqueVisitors = {};
    events.forEach(function (e) { if (e.anon_id) uniqueVisitors[e.anon_id] = true; });

    var pathCounts = {};
    pageViews.forEach(function (e) {
      var p = (e.meta && e.meta.path) || '(inconnu)';
      pathCounts[p] = (pathCounts[p] || 0) + 1;
    });

    // Clics par bouton : les evenements avec un sous-detail (cta/target/tab
    // dans meta) sont eclates ("landing_cta_click · hero_signup"), les
    // autres restent groupes par leur nom brut ("signup", "plan_chosen"...).
    var clickCounts = {};
    clicks.forEach(function (e) {
      var m = e.meta || {};
      var detail = m.cta || m.target || m.tab || m.plan || null;
      var label = detail ? (e.name + ' · ' + detail) : e.name;
      clickCounts[label] = (clickCounts[label] || 0) + 1;
    });

    var days = last14Days();
    var dayCounts = {};
    days.forEach(function (d) { dayCounts[d] = 0; });
    pageViews.forEach(function (e) {
      var k = dayKey(e.created_at);
      if (k in dayCounts) dayCounts[k] += 1;
    });

    var recent = events.slice(0, 40);
    var recentSignups = profiles.slice(0, 15);

    zone.innerHTML =
      '<div class="detailed-stats-heading" style="margin-top:0">Inscriptions</div>' +
      (profilesRes.error
        ? '<div class="chart-card"><p class="empty-state" style="padding:12px 0">Impossible de lire les profils (' + window.ITBOY.ui.escapeHtml(profilesRes.error.message || 'erreur inconnue') + '). La policy "profiles_select_owner" a-t-elle bien ete executee dans le SQL editor ?</p></div>'
        : '<div class="detailed-stats-grid">' +
          '<div class="stat-tile"><div class="value">' + profiles.length + '</div><div class="label">Inscrits au total</div></div>' +
          '<div class="stat-tile"><div class="value">' + countSince(profiles, 24) + '</div><div class="label">Inscrits / 24h</div></div>' +
          '<div class="stat-tile"><div class="value">' + countSince(profiles, 24 * 7) + '</div><div class="label">Inscrits / 7 jours</div></div>' +
          '<div class="stat-tile"><div class="value">' + profiles.filter(function (p) { return p.plan === 'premium'; }).length + '</div><div class="label">En Premium</div></div>' +
          '</div>' +
          '<div class="chart-card" style="padding:0;overflow:hidden;margin-top:6px">' +
          (recentSignups.length
            ? '<div style="max-height:360px;overflow-y:auto">' +
              recentSignups.map(function (p) {
                var when = new Date(p.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 20px;border-top:1px solid rgba(246,246,246,0.06);font-size:13px">' +
                  '<span style="color:var(--white)">' + window.ITBOY.ui.escapeHtml(p.email || '(email inconnu)') + (p.plan === 'premium' ? ' <span class="link-muted" style="color:var(--gold)">· premium</span>' : '') + '</span>' +
                  '<span class="link-muted" style="white-space:nowrap">' + when + '</span>' +
                  '</div>';
              }).join('') +
              '</div>'
            : '<p class="empty-state" style="padding:20px">Aucun inscrit pour l\'instant.</p>') +
          '</div>') +

      '<div class="detailed-stats-heading" style="margin-top:28px">Vues</div>' +
      '<div class="detailed-stats-grid">' +
      '<div class="stat-tile"><div class="value">' + pageViews.length + '</div><div class="label">Vues (5000 derniers évènements)</div></div>' +
      '<div class="stat-tile"><div class="value">' + countSince(pageViews, 24) + '</div><div class="label">Vues / 24h</div></div>' +
      '<div class="stat-tile"><div class="value">' + countSince(pageViews, 24 * 7) + '</div><div class="label">Vues / 7 jours</div></div>' +
      '<div class="stat-tile"><div class="value">' + Object.keys(uniqueVisitors).length + '</div><div class="label">Visiteurs uniques</div></div>' +
      '</div>' +

      '<div class="detailed-stats-heading">Vues par jour (14 derniers jours)</div>' +
      '<div class="chart-card"><div class="chart-body"><canvas id="daily-views-chart"></canvas></div></div>' +

      '<div class="detailed-stats-heading">Pages les plus vues</div>' +
      renderTopList('Par chemin (path)', topEntries(pathCounts, 10), 'Aucune vue enregistrée pour l\'instant.') +

      '<div class="detailed-stats-heading" style="margin-top:28px">Clics par bouton / action</div>' +
      renderTopList('Tous évènements hors vues de page', topEntries(clickCounts, 15), 'Aucun clic suivi (data-track) pour l\'instant.') +

      '<div class="detailed-stats-heading" style="margin-top:28px">Activité récente</div>' +
      '<div class="chart-card" style="padding:0;overflow:hidden">' +
      (recent.length
        ? '<div style="max-height:420px;overflow-y:auto">' +
          recent.map(function (e) {
            var m = e.meta || {};
            var detail = m.path || m.cta || m.target || m.tab || m.plan || '';
            var when = new Date(e.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return '<div style="display:flex;justify-content:space-between;gap:12px;padding:12px 20px;border-top:1px solid rgba(246,246,246,0.06);font-size:13px">' +
              '<span style="color:var(--white)">' + window.ITBOY.ui.escapeHtml(e.name) + (detail ? ' <span class="link-muted">· ' + window.ITBOY.ui.escapeHtml(String(detail)) + '</span>' : '') + '</span>' +
              '<span class="link-muted" style="white-space:nowrap">' + when + '</span>' +
              '</div>';
          }).join('') +
          '</div>'
        : '<p class="empty-state" style="padding:20px">Rien pour l\'instant.</p>') +
      '</div>';

    if (!window.Chart) return; // CDN indisponible - le reste du dashboard reste visible

    var ctx = document.getElementById('daily-views-chart');
    if (ctx) {
      if (dailyChart) dailyChart.destroy();
      dailyChart = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: days.map(function (d) { return d.slice(5).replace('-', '/'); }),
          datasets: [{ data: days.map(function (d) { return dayCounts[d]; }), backgroundColor: 'rgba(205,163,78,0.75)', borderRadius: 3, maxBarThickness: 28 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8A8A8A', font: { family: 'Montserrat' } } },
            y: { beginAtZero: true, ticks: { color: '#8A8A8A', precision: 0, font: { family: 'Montserrat' } }, grid: { color: 'rgba(246,246,246,0.06)' } }
          }
        }
      });
    }
  }

  init();
})();
