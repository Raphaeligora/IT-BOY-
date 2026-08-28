# IT BOY — Landing page, Quiz, Compte, Plans, Tracker

Un seul projet/repo pour tout le parcours : landing → quiz → compte → choix
du plan → tracker d'habitudes.

Site statique (HTML/CSS/JS vanilla, sans framework ni build) — choix fait
parce que Node/npm n'est pas installé sur cette machine. Le backend est
Supabase (Postgres + Auth), utilisé directement depuis le front via son SDK
JS chargé en CDN — pas de serveur Node à faire tourner.

## Structure

```
index.html                    → landing page ("/")
quiz/index.html                → quiz, 5 questions ("/quiz/")
quiz/resultat/index.html       → écran résultat ("/quiz/resultat/")
signup/index.html              → création de compte ("/signup/")
login/index.html               → connexion ("/login/")
plans/index.html               → choix Free/Premium ("/plans/")
checkout/index.html            → placeholder paiement ("/checkout/")
dashboard/index.html           → tracker principal ("/dashboard/")
habits/index.html              → détail d'une habitude ("/habits/?id=<uuid>",
                                  adapté en query string faute de routeur serveur)

supabase/schema.sql            → tables + sécurité (RLS) + limite de plan en base

assets/css/style.css           → design system partagé
assets/js/lib/config.js        → identifiants Supabase (à remplir, voir plus bas)
assets/js/lib/supabaseClient.js→ initialise le client Supabase
assets/js/lib/auth.js          → signUp / signIn / signOut / requireUser
assets/js/lib/api.js           → toutes les requêtes DB (profiles, habits, logs...)
assets/js/lib/streak.js        → calcul du streak (fonction pure, testée)
assets/js/lib/mapping.js       → mapping réponses quiz → habitudes (fonction pure)
assets/js/lib/habitCatalog.js  → catalogue d'habitudes du quiz
assets/js/lib/plans.js         → constantes des plans (limites, features)
assets/js/lib/storage.js       → localStorage + envoi de la quiz_session
assets/js/lib/ui.js            → bandeaux d'erreur / config manquante
assets/js/{signup,login,plans,dashboard,habitDetail,quiz,resultat}.js
                                → logique d'affichage de chaque écran
```

## Mise en route (Supabase)

Le projet n'a pas encore d'instance Supabase connectée. Étapes :

1. **Créer un projet** sur [supabase.com](https://supabase.com) (compte à
   créer toi-même — je ne peux pas le faire à ta place).
2. **Exécuter le schéma** : dans le dashboard Supabase → SQL Editor → New
   query → coller tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) → Run.
   Ça crée les 4 tables (`profiles`, `quiz_sessions`, `habits`, `habit_logs`),
   active les policies RLS, et pose le trigger qui applique la limite de
   plan **en base** (3 habitudes actives en free, 10 en premium) — c'est ce
   qui empêche un utilisateur de contourner la limite en appelant l'API
   Supabase directement, comme l'exige le spec.
3. **Récupérer les identifiants** : Project Settings → API → copier
   `Project URL` et la clé `anon public`.
4. **Les coller dans** [`assets/js/lib/config.js`](assets/js/lib/config.js) :
   ```js
   window.ITBOY_CONFIG = {
     SUPABASE_URL: 'https://xxxxx.supabase.co',
     SUPABASE_ANON_KEY: 'eyJ...'
   };
   ```
5. (Optionnel) Dans Authentication → Providers → Email, désactiver
   "Confirm email" en dev si tu veux tester l'inscription sans boîte mail.

Tant que `config.js` n'est pas rempli, toutes les pages qui ont besoin de
Supabase (signup, login, plans, dashboard, habits) affichent un bandeau
"Configuration Supabase manquante" au lieu de planter — le reste du site
(landing, quiz) fonctionne sans backend.

## Prévisualiser en local

Depuis ce dossier :

```bash
python3 -m http.server 8000
```

puis ouvrir `http://localhost:8000/`.

## Ce qui n'est pas encore branché

- **Paiement Premium** : `/checkout` est un placeholder ("Paiement à
  venir"), volontairement — l'intégration Stripe est prévue dans un
  prompt séparé (voir contexte de `prompt-compte-tracker-itboy.md`).
- **Écran "habitudes archivées"** : le spec ne demande qu'un bouton
  archiver, pas d'écran pour les consulter/réactiver — pas construit ici.

## Ce qui a été testé sans backend réel

- `assets/js/lib/mapping.js` : les 144 combinaisons de réponses possibles
  ont été passées en revue (aucun résultat < 3 ou > 6 habitudes, aucun
  doublon).
- `assets/js/lib/streak.js` : streak courant (avec/sans trou, coché ou non
  aujourd'hui), meilleur streak historique, et taux de complétion —
  vérifiés sur des cas précis dans la console du navigateur.
- Toutes les pages dépendant de Supabase ont été chargées sans erreur
  JS lorsque la config est absente (bandeau affiché, pas de crash).

Ce qui n'a **pas** pu être testé faute d'un projet Supabase réel : le
trigger de limite de plan en conditions réelles, l'inscription/connexion,
et le flux complet d'activation/cochage d'habitudes. À vérifier une fois
`config.js` rempli — n'hésite pas à me redonner la main si quelque chose
coince.
