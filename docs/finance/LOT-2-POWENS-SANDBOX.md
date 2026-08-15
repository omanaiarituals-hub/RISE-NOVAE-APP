# NOVAÉ Finance — Lot 2 : Sandbox Powens en lecture seule

## Objectif

Valider le parcours Open Banking sans utiliser de données bancaires réelles :

1. NOVAÉ crée/associe un utilisateur Powens côté serveur.
2. L'utilisatrice est redirigée vers la Webview Powens.
3. Elle choisit un connecteur de démonstration/test et les comptes à partager.
4. Retour dans NOVAÉ.
5. NOVAÉ synchronise les connexions, comptes et transactions autorisés.
6. Les comptes apparaissent dans `/finances/banking`.
7. Les opérations apparaissent dans `/finances/transactions`.

## Sécurité

- Lecture seule dans l'abstraction NOVAÉ.
- Aucune méthode de paiement/virement dans `BankingProvider`.
- Aucun identifiant ni mot de passe bancaire saisi dans NOVAÉ.
- Jeton utilisateur Powens stocké chiffré côté serveur avec AES-256-GCM.
- `FINANCE_CREDENTIAL_ENCRYPTION_KEY` n'est jamais exposée côté client.
- Le fallback `FINANCE_DEV_PREVIEW_USER_ID` est impossible en production.

## Pré-requis avant la première connexion

- Les migrations Finance Lot 0 et Lot 1 doivent être appliquées dans Supabase.
- Un domaine Powens de test/sandbox doit être créé.
- Les variables `POWENS_DOMAIN`, `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET` et `FINANCE_CREDENTIAL_ENCRYPTION_KEY` doivent être renseignées.
- `FINANCE_BANKING_PROVIDER=powens` doit être activé seulement après ces étapes.

## Validation Lot 2

Le lot est validé quand :

- la Webview Powens s'ouvre depuis NOVAÉ ;
- aucun identifiant bancaire n'est saisi dans NOVAÉ ;
- un connecteur de démonstration peut être sélectionné ;
- le retour vers `/finances/banking` fonctionne ;
- au moins un compte de test est sauvegardé dans `finance_accounts` ;
- des transactions de test apparaissent dans `/finances/transactions` ;
- le bouton Déconnecter arrête la synchronisation et supprime le jeton fournisseur côté NOVAÉ.
