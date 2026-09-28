/* IT BOY — Aides d'authentification (fonctions pures/asynchrones,
   sans DOM, réutilisées par signup.js / login.js / dashboard.js / ...). */

(function (global) {
  function client() { return global.ITBOY.supabase; }

  async function getUser() {
    if (!client()) return null;
    var res = await client().auth.getUser();
    return (res && res.data && res.data.user) || null;
  }

  // Redirige vers la page de login si personne n'est connecté.
  // Retourne l'utilisateur sinon.
  async function requireUser(loginPath) {
    var user = await getUser();
    if (!user) {
      window.location.href = loginPath || '../login/';
      return null;
    }
    return user;
  }

  async function signUp(email, password) {
    var res = await client().auth.signUp({ email: email, password: password });
    if (res.error) throw res.error;
    // Si la confirmation email est activée sur le projet Supabase,
    // `session` est null tant que le lien reçu par email n'a pas été
    // cliqué — l'appelant doit gérer ce cas (pas de connexion immédiate).
    return { user: res.data.user, session: res.data.session };
  }

  async function signIn(email, password) {
    var res = await client().auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw res.error;
    return res.data.user;
  }

  async function signOut() {
    if (client()) await client().auth.signOut();
    window.location.href = '../login/';
  }

  // Envoie un email avec un lien de reinitialisation. Le lien renvoie sur
  // /reset-password/ avec une session de type "recovery" (geree par
  // Supabase cote client, via le hash de l'URL) qui autorise UNE seule
  // fois l'appel a updatePassword ci-dessous.
  async function resetPasswordForEmail(email) {
    var res = await client().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password/'
    });
    if (res.error) throw res.error;
  }

  // A appeler uniquement depuis /reset-password/, une fois la session de
  // recuperation etablie (voir resetPassword.js).
  async function updatePassword(newPassword) {
    var res = await client().auth.updateUser({ password: newPassword });
    if (res.error) throw res.error;
    return res.data.user;
  }

  global.ITBOY = global.ITBOY || {};
  global.ITBOY.auth = {
    getUser: getUser,
    requireUser: requireUser,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resetPasswordForEmail: resetPasswordForEmail,
    updatePassword: updatePassword
  };
})(window);
