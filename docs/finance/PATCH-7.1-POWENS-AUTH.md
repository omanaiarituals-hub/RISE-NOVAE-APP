# Finance Patch 7.1 — Powens auth/init

Le Lot 7 lisait `access_token` / `token` après `POST /2.0/auth/init`.
La réponse documentée par Powens utilise `auth_token` pour le jeton utilisateur créé par cet endpoint.

Le patch lit maintenant `auth_token` en priorité puis conserve les anciens noms en fallback.

En cas de réponse sans jeton, NOVAÉ journalise uniquement le code HTTP et les noms de champs non sensibles. Les valeurs de token, secrets, mots de passe et credentials ne sont jamais journalisées.

Le flux reste strictement en lecture seule.
