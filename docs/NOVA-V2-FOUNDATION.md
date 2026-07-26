# Nova V2 · Fondation, tâches et rappels

## État actuel

Nova V2 fonctionne dans un laboratoire privé accessible uniquement aux comptes autorisés. Elle utilise un routeur multi-fournisseurs, prépare des actions structurées, demande une validation explicite puis exécute uniquement les moteurs autorisés.

## Moteurs actifs

- Création sécurisée d’une tâche dans `todo_list`.
- Détection des doublons avant écriture.
- Programmation d’un rappel rattaché à une tâche existante dans `task_reminders`.
- Envoi du rappel par notification push et notification interne via le cron existant `/api/cron/reminder`.

Les rendez-vous, le planner, les règles familiales, les documents et les autres moteurs restent en simulation.

## Sécurité

- Authentification Supabase obligatoire.
- Liste d’adresses autorisées possible avec `NOVA_V2_LAB_ALLOWED_EMAILS`.
- Proposition signée avec `NOVA_ACTION_SIGNING_SECRET`.
- Aucune écriture avant confirmation explicite.
- Relecture de la donnée après création.
- Protection contre les doublons.
- RLS sur les tâches et les rappels.
- Aucun identifiant technique n’est affiché dans la conversation.

## Variables nécessaires

```env
NOVA_V2_LAB_ENABLED=true
NOVA_V2_LAB_ALLOWED_EMAILS=ton-adresse@email.fr
NOVA_AI_PROVIDER_ORDER=anthropic,openai
NOVA_ANTHROPIC_MODEL=claude-haiku-4-5
NOVA_OPENAI_MODEL=gpt-5.6-luna
NOVA_ACTION_SIGNING_SECRET=une-valeur-aleatoire-d-au-moins-32-caracteres
```

Les variables suivantes doivent également exister côté serveur :

```env
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contact@omanaia.com
```

## Migration requise pour les rappels

Exécuter le fichier suivant dans Supabase SQL Editor avant de tester les rappels :

```text
docs/database/nova-task-reminders.sql
```

## Tests recommandés

### Création de tâche

> Je dois envoyer mon dossier à la CPAM avant vendredi.

Après validation, vérifier que la tâche existe dans la to-do et qu’un second essai ne crée pas de doublon.

### Rappel rattaché à la tâche

> Rappelle-moi cette tâche demain à 19 h.

Nova doit retrouver la tâche existante, demander confirmation puis programmer un seul rappel. Si la date ou l’heure manque, elle doit poser une question avant de proposer l’exécution.

## Fonctionnement des notifications

Le cron `/api/cron/reminder` est déjà exécuté toutes les cinq minutes par Vercel. Il traite désormais :

- les rappels des événements du planner ;
- les rappels Nova rattachés aux tâches.

Si une tâche est terminée ou annulée avant l’heure prévue, son rappel est automatiquement annulé. Si les notifications « Planning & conflits » sont désactivées, le rappel n’est pas envoyé.

## Résolution sémantique des tâches

Nova V2 compare désormais le sens des tâches actives, et pas uniquement leur intitulé exact. Lorsque deux tâches semblent représenter la même action, Nova propose de conserver l’intitulé le plus clair et d’archiver le doublon. La fusion exige une validation explicite. Les rappels encore actifs sont transférés vers la tâche conservée ; un rappel identique est annulé plutôt que dupliqué. La tâche doublon reste traçable grâce aux champs `merged_into_todo_id` et `merged_at`.
