# Fondation Nova V2 · Laboratoire en lecture seule

## Objectif

Cette fondation ajoute une couche IA indépendante des fournisseurs sans modifier les routes actuelles de Nova. Elle permet de tester l’analyse d’une situation et la préparation d’actions structurées. Aucune donnée n’est écrite dans Supabase.

## Nouveaux fichiers

```text
src/lib/nova-ai/
  types.ts
  schema.ts
  json.ts
  normalize.ts
  provider.ts
  prompt.ts
  router.ts
  providers/anthropic.ts
  providers/openai.ts

src/app/api/nova/plan/route.ts
src/app/dev/nova-lab/page.tsx
src/app/dev/nova-lab/NovaLabClient.tsx
```

## Variables à ajouter dans `.env.local`

```env
NOVA_V2_LAB_ENABLED=true
NOVA_V2_LAB_ALLOWED_EMAILS=ton-adresse@email.fr
NOVA_AI_PROVIDER_ORDER=anthropic,openai
NOVA_ANTHROPIC_MODEL=claude-haiku-4-5
NOVA_OPENAI_MODEL=gpt-5.6-luna
```

Les clés `ANTHROPIC_API_KEY` et `OPENAI_API_KEY` restent dans `.env.local`. Ne jamais les préfixer par `NEXT_PUBLIC_`.

## Accès

1. Démarrer l’application avec `npm run dev`.
2. Se connecter normalement.
3. Ouvrir `http://localhost:3000/dev/nova-lab`.
4. Choisir `Automatique avec secours` pour tester le routeur.

## Sécurité

- La page renvoie 404 tant que `NOVA_V2_LAB_ENABLED` n’est pas à `true`.
- Une liste d’adresses autorisées peut être définie.
- L’API exige un token Supabase valide.
- Le rate limit est fixé à 30 analyses par heure et par utilisatrice.
- Le mode est strictement `dryRun`: aucune tâche, aucun rappel et aucun événement ne sont créés.
- OpenAI est appelé avec `store: false`.

## Test de secours

Pour vérifier le basculement sans supprimer de clé :

1. Mettre temporairement un faux modèle dans `NOVA_ANTHROPIC_MODEL`.
2. Garder `NOVA_AI_PROVIDER_ORDER=anthropic,openai`.
3. Relancer le serveur.
4. Lancer une analyse en mode automatique.
5. Le champ `attemptedProviders` doit afficher `anthropic → openai`, et `provider` doit valoir `openai`.

Remettre ensuite le bon modèle Anthropic.

## Étape suivante après validation

Ne pas brancher immédiatement toutes les écritures. Commencer par un seul flux :

1. Nova prépare `create_task`.
2. L’interface affiche la proposition.
3. L’utilisatrice confirme explicitement.
4. Une route d’exécution dédiée vérifie à nouveau les paramètres.
5. La tâche est créée et relue en base avant confirmation à l’utilisatrice.
