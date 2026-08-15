# NOVAÉ Finance — Lot 1 — Open Banking lecture seule

## Objet

Ce lot prépare et branche l'adaptateur Powens derrière le contrat `BankingProvider` déjà créé au Lot 0.
Aucune méthode de paiement, de virement ou d'initiation de paiement n'existe dans l'interface interne NOVAÉ.

## Sécurité

- L'authentification bancaire a lieu dans la Webview Powens.
- Aucun login ou mot de passe bancaire n'est saisi dans NOVAÉ.
- Le jeton utilisateur Powens nécessaire à la synchronisation est chiffré côté serveur avec AES-256-GCM.
- La clé de chiffrement reste exclusivement dans les variables d'environnement serveur.
- La table `finance_provider_credentials` n'a aucune policy RLS client : service_role uniquement.

## Variables serveur

- `FINANCE_BANKING_PROVIDER=powens`
- `POWENS_DOMAIN=<sous-domaine Powens sans .biapi.pro>`
- `POWENS_CLIENT_ID=<id client>`
- `POWENS_CLIENT_SECRET=<secret client>`
- `FINANCE_CREDENTIAL_ENCRYPTION_KEY=<32 octets, 64 caractères hex ou base64>`
- optionnel : `POWENS_WEBVIEW_URL=https://webview.powens.com/connect`

## Flux

1. POST `/api/finance/banking/connect`
2. NOVAÉ crée/récupère le profil utilisateur fournisseur côté serveur.
3. NOVAÉ génère un code Webview à courte durée de vie.
4. Le navigateur quitte NOVAÉ pour la Webview Powens.
5. L'utilisatrice choisit sa banque et les comptes qu'elle consent à partager.
6. Retour vers `/finances/banking?connection=return`.
7. POST `/api/finance/banking/sync` importe les connexions, comptes et transactions en lecture seule.

## UX ajoutée

- Le lien « Accueil » des pages Finance est remplacé par un vrai bouton « Retour » contextuel.
- La barre de navigation globale reste le chemin vers l'accueil principal.
- Les enveloppes affichées au Lot 0 restent des exemples UX jusqu'au lot de moteur/enveloppes réelles.
