# Finance Patch 7.2 — sélection et gestion des comptes

Powens applique un filtrage implicite sur ses collections: les comptes désactivés sont exclus des réponses par défaut. Le paramètre `all` réinclut explicitement ces comptes. Le patch retire donc `?all` de `listAccounts` afin que la synchronisation NOVAÉ reflète le consentement individuel donné dans la Webview.

NOVAÉ ajoute ensuite une préférence locale indépendante (`user_enabled`). Elle permet d'exclure un compte des calculs sans modifier le consentement bancaire ni supprimer l'historique. `custom_name` permet de renommer l'affichage localement.

Règles:
- `is_active`: état venant du fournisseur / consentement Powens.
- `user_enabled`: choix local NOVAÉ.
- Un compte participe aux soldes, transactions et analyses seulement si les deux sont vrais.
- Pour réautoriser un compte désactivé chez Powens, l'utilisateur repasse par « Ajouter / reconnecter une banque ».
- La création d'un compte bancaire reste exclusivement issue de la synchronisation fournisseur; aucun faux compte bancaire manuel n'est créé.
