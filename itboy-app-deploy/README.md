# IT BOY — Landing page, Quiz, Compte, Plans, Tracker, Paiement Premium

Un seul projet/repo pour tout le parcours : landing -> quiz -> compte -> choix
du plan -> paiement Premium -> tracker d'habitudes.

Site statique (HTML/CSS/JS vanilla, sans framework ni build) pour les pages,
avec Supabase (Postgres + Auth) comme backend, utilise directement depuis le
front via son SDK JS charge en CDN. Le paiement Premium ajoute deux petites
fonctions serverless Vercel (dossier api/) - c'est la seule partie qui a
besoin de Node/npm (juste pour installer leurs dependances, aucun serveur a
faire tourner soi-meme : Vercel s'en charge).

## Structure

```
index.html                    -> landing page ("/")
quiz/index.html                -> quiz, 5 questions ("/quiz/")
quiz/resultat/index.html       -> ecran resultat ("/quiz/resultat/")
signup/index.html              -> creation de compte ("/signup/")
login/index.html               -> connexion ("/login/")
plans/index.html               -> choix Free/Premium ("/plans/")
checkout/index.html            -> demarre le paiement Stripe Premium ("/checkout/")
dashboard/index.html           -> tracker principal ("/dashboard/")
habits/index.html               -> detail d'une habitude ("/habits/?id=<uuid>",
                                  adapte en query string faute de routeur serveur)

api/create-checkout-session.js -> fonction serverless : cree la session Stripe Checkout
api/stripe-webhook.js          -> fonction serverless : recoit les evenements Stripe,
                                  met a jour profiles.plan dans Supabase
package.json                   -> dependances des fonctions serverless (stripe, @supabase/supabase-js)

supabase/schema.sql            -> tables + securite (RLS) + limite de plan en base
                                  + colonnes stripe_customer_id / stripe_subscription_id

assets/css/style.css           -> design system partage
assets/js/lib/config.js        -> identifiants Supabase (a remplir, voir plus bas)
assets/js/lib/supabaseClient.js-> initialise le client Supabase
assets/js/lib/auth.js          -> signUp / signIn / signOut / requireUser
assets/js/lib/api.js           -> toutes les requetes DB (profiles, habits, logs...)
assets/js/lib/streak.js        -> calcul du streak (fonction pure, testee)
assets/js/lib/mapping.js       -> mapping reponses quiz -> habitudes (fonction pure)
assets/js/lib/habitCatalog.js  -> catalogue d'habitudes du quiz
assets/js/lib/plans.js         -> constantes des plans (limites, features)
assets/js/lib/storage.js       -> localStorage + envoi de la quiz_session
assets/js/lib/ui.js            -> bandeaux d'erreur / config manquante
assets/js/{signup,login,plans,dashboard,habitDetail,quiz,resultat,checkout}.js
                                -> logique d'affichage de chaque ecran
```

## Mise en route (Supabase)

1. **Creer un projet** sur [supabase.com](https://supabase.com) (compte a
   creer toi-meme - je ne peux pas le faire a ta place).
2. **Executer le schema** : dans le dashboard Supabase -> SQL Editor -> New
   query -> coller tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) -> Run.
   Ca cree les 4 tables (`profiles`, `quiz_sessions`, `habits`, `habit_logs`),
   active les policies RLS, et pose le trigger qui applique la limite de
   plan **en base** (3 habitudes actives en free, 10 en premium) - c'est ce
   qui empeche un utilisateur de contourner la limite en appelant l'API
   Supabase directement, comme l'exige le spec.
3. **Recuperer les identifiants** : Project Settings -> API -> copier
   `Project URL` et la cle `anon public`.
4. **Les coller dans** [`assets/js/lib/config.js`](assets/js/lib/config.js) :
   ```js
   window.ITBOY_CONFIG = {
     SUPABASE_URL: 'https://xxxxx.supabase.co',
     SUPABASE_ANON_KEY: 'eyJ...'
   };
   ```
5. (Optionnel) Dans Authentication -> Providers -> Email, desactiver
   "Confirm email" en dev si tu veux tester l'inscription sans boite mail.

Tant que `config.js` n'est pas rempli, toutes les pages qui ont besoin de
Supabase (signup, login, plans, dashboard, habits, checkout) affichent un
bandeau "Configuration Supabase manquante" au lieu de planter - le reste du
site (landing, quiz) fonctionne sans backend.

## Paiement Premium (Stripe)

Le paywall est branche en mode **test** Stripe. Deux fonctions serverless
Vercel gerent le paiement - le front n'a jamais acces a une cle secrete.

**Comment ca marche :** l'utilisateur clique "Choisir Premium" sur `/plans/`
-> `/checkout/` appelle `api/create-checkout-session.js` (avec son jeton de
session Supabase) -> redirection vers la page de paiement Stripe -> une fois
paye, Stripe appelle `api/stripe-webhook.js` qui passe `profiles.plan` a
`'premium'` dans Supabase. Le dashboard applique alors automatiquement la
limite de 10 habitudes (deja gere par `PLAN_LIMITS` cote front et par le
trigger `enforce_habit_limit` cote base - rien a modifier la).

**Variables d'environnement a ajouter dans Vercel** (Project -> Settings ->
Environment Variables) - a saisir toi-meme, ce sont des secrets :

| Nom | Ou la trouver |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe -> Developpeurs -> Cles API -> cle secrete (mode test : `sk_test_...`) |
| `STRIPE_PRICE_ID_PREMIUM` | Stripe -> Produits -> creer un Price recurrent a 4.99E/mois pour "IT BOY Premium" -> copier son `price_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe -> Developpeurs -> Webhooks -> (creer/ouvrir le endpoint `https://<ton-domaine>/api/stripe-webhook`, evenements `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) -> "Signing secret" (`whsec_...`) |
| `SUPABASE_URL` | Supabase -> Project Settings -> API -> Project URL (meme valeur que `config.js`) |
| `SUPABASE_SECRET_KEY` | Supabase -> Project Settings -> API Keys -> onglet "Publishable and secret API keys" -> cle secrete (`sb_secret_...`) - **jamais** la cle `anon` |
| `PUBLIC_SITE_URL` | optionnel - URL publique du site, ex. `https://it-boy.vercel.app` (sinon deduite automatiquement de la requete) |

Une fois ces variables ajoutees et le prochain deploiement termine, le
endpoint `api/stripe-webhook.js` existe en prod : retourne dans Stripe ->
Webhooks pour terminer la creation du endpoint (coller son URL) et recuperer
le `STRIPE_WEBHOOK_SECRET` definitif si ce n'est pas deja fait.

**Test de bout en bout** (mode test Stripe, aucune carte reelle) : sur
`/checkout/`, utiliser la carte `4242 4242 4242 4242`, une date future et
n'importe quel CVC. Verifier ensuite que `profiles.plan` est passe a
`'premium'` pour ce compte et que le dashboard autorise bien 10 habitudes.

## Previsualiser en local

Depuis ce dossier :

```bash
python3 -m http.server 8000
```

puis ouvrir `http://localhost:8000/`. (Les pages `/checkout/` et le webhook
ont besoin d'un deploiement Vercel pour fonctionner - les fonctions `api/`
ne tournent pas avec ce serveur statique local.)

## Ce qui n'est pas encore branche

- **Ecran "habitudes archivees"** : le spec ne demande qu'un bouton
  archiver, pas d'ecran pour les consulter/reactiver - pas construit ici.

## Ce qui a ete teste sans backend reel

- `assets/js/lib/mapping.js` : les 144 combinaisons de reponses possibles
  ont ete passees en revue (aucun resultat < 3 ou > 6 habitudes, aucun
  doublon).
- `assets/js/lib/streak.js` : streak courant (avec/sans trou, coche ou non
  aujourd'hui), meilleur streak historique, et taux de completion -
  verifies sur des cas precis dans la console du navigateur.
- Toutes les pages dependant de Supabase ont ete chargees sans erreur
  JS lorsque la config est absente (bandeau affiche, pas de crash).

Ce qui a ete teste avec le vrai projet Supabase : inscription/connexion,
redirection vers `/plans` puis `/dashboard`, activation d'habitudes issues
du quiz, limite de 3 habitudes en Free, cochage/decochage du jour, streak,
persistance apres deconnexion/reconnexion.

Ce qui n'a **pas** encore ete teste en conditions reelles : le paiement
Stripe de bout en bout (necessite que les variables d'environnement
ci-dessus soient ajoutees dans Vercel).
