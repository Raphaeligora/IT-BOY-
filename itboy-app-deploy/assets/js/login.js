/* IT BOY - Ecran /login */

(function () {
    var bannerZone = document.getElementById('banner-zone');
    var form = document.getElementById('login-form');
    var submitBtn = document.getElementById('submit-btn');

   if (!window.ITBOY.isSupabaseConfigured) {
         window.ITBOY.ui.showConfigBanner(bannerZone);
         submitBtn.disabled = true;
         return;
   }

   form.addEventListener('submit', async function (e) {
         e.preventDefault();
         bannerZone.innerHTML = '';
         submitBtn.disabled = true;

                             var email = form.email.value.trim();
         var password = form.password.value;

                             try {
                                     var user = await window.ITBOY.auth.signIn(email, password);

           var sessionId = window.ITBOY.storage.getSessionId();
                                     if (sessionId) {
                                               try {
                                                           await window.ITBOY.api.linkQuizSessionToUser(sessionId, user.id);
                                                           window.ITBOY.storage.clearSessionId();
                                               } catch (linkErr) {
                                                           console.warn('[itboy] echec du rattachement de la quiz_session :', linkErr);
                                               }
                                     }

           var profile = null;
                                     try { profile = await window.ITBOY.api.getProfile(user.id); } catch (profileErr) { }

           window.location.href = (profile && profile.onboarded) ? '../dashboard/' : '../plans/';
                             } catch (err) {
                                     window.ITBOY.ui.showError(bannerZone, err);
                                     submitBtn.disabled = false;
                             }
   });
})();
