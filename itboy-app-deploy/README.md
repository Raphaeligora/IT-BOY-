# IT BOY — Landing page, Compte, Plans, Tracker, Paiement Premium

Un seul projet/repo pour tout le parcours : landing -> compte -> choix du
plan -> paiement Premium -> tracker d'habitudes.

Site statique (HTML/CSS/JS vanilla, sans framework ni build) pour les pages,
avec Supabase (Postgres + Auth) comme backend, utilise directement depuis le
front via son SDK JS charge en CDN. Le paiement Premium ajoute deux petites
fonctions serverless Vercel (dossier api/) - c'est la seule partie qui a
besoin de Node/npm (juste pour installer leurs dependances, aucun serveur a
faire tourner soi-meme : Vercel s'en charge).

## Structure

```
index.html                    -> landing page ("/")
signup/index.html              -> creation de compte ("/signup/")
login/index.html               -> connexion ("/login/")
plans/index.html               -> choix Free/Premium ("/plans/")
checkout/index.html            -> demarre le paiement Stripe Premium ("/checkout/")
dashboard/index.html           -> tracker principal ("/dashboard/")
habits/index.html               -> detail d'une habitude ("/habits/?id=<uuid>",
                                  adapte en query string faute de routeur serveur)

api/create-checkout-session.js -> fonction serverless : cree la session Stripe Checkout
api/stripe-webhook.js          -> fonction serverless : recoit les evenements Stripe,
                                  met a jour profiles.plan dans Supabase et journalise
                                  l'evenement "premium_activated"
package.json                   -> dependances des fonctions serverless (stripe, @supabase/supabase-js)

supabase/schema.sql            -> tables + securite (RLS) + limite de plan en base
                                  + colonnes stripe_customer_id / stripe_subscription_id
                                  + archivage automatique au downgrade + table events

assets/css/style.css           -> design system partage
assets/js/lib/config.js        -> identifiants Supabase (a remplir, voir plus bas)
assets/js/lib/supabaseClient.js-> initialise le client Supabase
assets/js/lib/auth.js          -> signUp / signIn / signOut / requireUser
assets/js/lib/api.js           -> toutes les requetes DB (profiles, habits, logs...)
assets/js/lib/streak.js        -> calcul du streak (fonction pure, testee)
assets/js/lib/plans.js         -> constantes des plans (limites, features)
assets/js/lib/track.js         -> tracking produit best-effort (table events)
assets/js/lib/ui.js            -> bandeaux d'erreur / config manquante
assets/js/{signup,login,plans,dashboard,habitDetail,checkout}.js
                                -> logique d'affichage de chaque ecran
```

## Les deux plans

| | Free | Premium — 4,99€/mois |
|---|---|---|
| Habitudes suivies | 3 maximum | Illimitees |
| Historique affiche | 30 derniers jours | Historique complet |
| Statistiques | Streak, meilleur streak, taux 7j/30j | Idem + vue detaillee |

Pas de palier intermediaire, pas de quiz : landing -> inscription -> choix du
plan -> tracker. Le streak et le taux de completion se calculent **toujours**
sur l'historique complet des coches, meme en Free - seule la fenetre
affichee dans le calendrier (`heatmap`) est limitee a 30 jours ; ce n'est
qu'une limite d'affichage, pas une regle de securite.

**Downgrade Premium -> Free** : aucune habitude n'est jamais supprimee ni
bloquee. Si l'utilisateur repasse en Free avec plus de 3 habitudes actives,
un trigger Postgres (`enforce_plan_downgrade`, section 7 de `schema.sql`)
archive automatiquement les plus recentes pour n'en garder que 3 actives -
les donnees restent intactes et consultables si l'utilisateur repasse en
Premium.

## Mise en route (Supabase)

1. **Creer un projet** sur [supabase.com](https://supabase.com) (compte a
   creer toi-meme - je ne peux pas le faire a ta place).
2. **Executer le schema** : dans le dashboard Supabase -> SQL Editor -> New
   query -> coller tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) -> Run.
   Ca cree les tables (`profiles`, `habits`, `habit_logs`, `events`), active
   les policies RLS, et pose les triggers qui appliquent **en base** :
   - la limite de plan (3 habitudes actives en free, illimite en premium) -
     ce qui empeche un utilisateur de la contourner en appelant l'API
     Supabase directement ;
   - l'archivage automatique au downgrade Premium -> Free decrit ci-dessus.
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
bandeau "Configuration Supabase manquante" au lieu de planter - la landing
page fonctionne sans backend (le tracking des clics CTA s'y desactive
simplement, sans erreur).

## Tracking produit (table `events`)

Une table `events` (voir section 7b de `schema.sql`) recoit des evenements
simples ecrits directement depuis le front via `assets/js/lib/track.js` :
`landing_cta_click`, `signup`, `first_habit_created`, `plan_chosen`,
`checkout_started`, `premium_activated` (celui-ci ecrit cote serveur par le
webhook Stripe). Chaque appel est best-effort et n'attend jamais de reponse
avant une navigation - un echec (offline, RLS, config absente) ne casse
jamais le parcours utilisateur. Un `anon_id` persistant en localStorage
relie les evenements d'un meme visiteur avant qu'il ait un compte.

## Paiement Premium (Stripe)

Le paywall est branche en mode **test** Stripe. Deux fonctions serverless
Vercel gerent le paiement - le front n'a jamais acces a une cle secrete.

**Comment ca marche :** l'utilisateur clique "Choisir Premium" sur `/plans/`
-> `/checkout/` appelle `api/create-checkout-session.js` (avec son jeton de
session Supabase) -> redirection vers la page de paiement Stripe -> une fois
paye, Stripe appelle `api/stripe-webhook.js` qui passe `profiles.plan` a
`'premium'` dans Supabase et journalise l'evenement `premium_activated`. Le
dashboard applique alors automatiquement la limite illimitee (deja gere par
`PLAN_LIMITS` cote front et par le trigger `enforce_habit_limit` cote base -
rien a modifier la).

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
`'premium'` pour ce compte et que le dashboard autorise bien un nombre
illimite d'habitudes.

## Previsualiser en local

Depuis ce dossier :

```bash
python3 -m http.server 8000
```

puis ouvrir `http://localhost:8000/`. (Les pages `/checkout/` et le webhook
ont besoin d'un deploiement Vercel pour fonctionner - les fonctions `api/`
ne tournent pas avec ce serveur statique local.)

## Ce qui n'est pas encore branche

- **Ecran "habitudes archivees"** : ni pour l'archivage manuel (bouton
  archiver) ni pour l'archivage automatique au downgrade - pas d'ecran pour
  les consulter/reactiver, construit ici.
- **Connexion Google (OAuth)** : necessite de configurer un client OAuth
  Google Cloud et d'activer le provider correspondant dans le dashboard
  Supabase - a faire manuellement, aucune cle disponible ici.
- **Rappels quotidiens (push/email)** : necessite de choisir et provisionner
  un service tiers (cles VAPID pour le push, un fournisseur email type
  Resend/Postmark) - pas construit ici faute d'identifiants.
- **Statistiques Premium avancees** (repartition mensuelle, correlations
  entre habitudes) : seules les statistiques de base (streak, meilleur
  streak, taux 7j/30j, fenetre d'historique 30j/complet) sont branchees.

## Ce qui a ete teste sans backend reel

- `assets/js/lib/streak.js` : streak courant (avec/sans trou, coche ou non
  aujourd'hui), meilleur streak historique, et taux de completion -
  verifies sur des cas precis dans la console du navigateur.
- Toutes les pages dependant de Supabase ont ete chargees sans erreur
  JS lorsque la config est absente (bandeau affiche, pas de crash).
- La landing page charge et fonctionne (CTA, onglets d'apercu produit,
  FAQ) meme sans configuration Supabase.

Ce qui a ete teste avec le vrai projet Supabase : inscription/connexion,
redirection vers `/plans` puis `/dashboard`, limite de 3 habitudes en Free,
cochage/decochage du jour, streak, persistance apres deconnexion/reconnexion.

Ce qui n'a **pas** encore ete teste en conditions reelles : le paiement
Stripe de bout en bout (necessite que les variables d'environnement
ci-dessus soient ajoutees dans Vercel), et le trigger d'archivage automatique
au downgrade (necessite d'executer la section 7 mise a jour de
`supabase/schema.sql` sur le projet Supabase reel).
