# NOVAÉ Finance — Lot 7 — Powens sandbox + navigation mobile

## Objectif

Valider le parcours Open Banking avec des données de test avant toute banque réelle, tout en rendant les onglets Finance compréhensibles sur smartphone/tablette.

## Sécurité

- Lecture seule uniquement.
- Aucun paiement, virement ou paiement initié par NOVAÉ.
- Les identifiants bancaires restent dans la Webview sécurisée du fournisseur.
- Les secrets Powens restent côté serveur.
- Le parcours Webview est explicitement filtré sur la capacité `bank`.

## Variables locales

```env
FINANCE_BANKING_PROVIDER=powens
POWENS_DOMAIN=votre-projet-sandbox.biapi.pro
POWENS_CLIENT_ID=
POWENS_CLIENT_SECRET=
POWENS_WEBVIEW_URL=https://webview.powens.com/connect
# Optionnel : limiter la Webview à un/des connecteurs de test autorisés dans la console.
POWENS_CONNECTOR_IDS=
FINANCE_CREDENTIAL_ENCRYPTION_KEY=
```

`POWENS_DOMAIN` accepte aussi la forme courte `votre-projet-sandbox`.

## Parcours de validation

1. Vérifier que `/finances/banking` affiche `Sandbox Powens` et `Adaptateur : Prêt`.
2. Cliquer sur `Connecter une banque de test`.
3. Choisir uniquement une institution/connexion de démonstration activée dans le domaine sandbox.
4. Revenir dans NOVAÉ et vérifier la synchronisation automatique.
5. Vérifier les comptes et soldes récupérés.
6. Ouvrir `/finances/transactions` et vérifier les transactions de démonstration.
7. Lancer `Synchroniser maintenant` et vérifier l'idempotence (pas de doublons).
8. Déconnecter puis vérifier que la synchronisation s'arrête.

## Navigation mobile

La barre d'onglets Finance reste horizontalement scrollable mais affiche maintenant des chevrons et des fondus uniquement lorsqu'il reste du contenu hors écran. L'onglet actif est automatiquement ramené dans la zone visible.
