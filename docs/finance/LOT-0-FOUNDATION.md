# NOVAÉ Finance — Lot 0 Fondations

## Objectif

Poser la base technique du module Finance sans connecter encore de compte bancaire réel.

Principes figés :

- Open Banking en lecture seule ;
- aucun paiement ni virement depuis NOVAÉ ;
- aucun identifiant bancaire stocké par NOVAÉ ;
- fournisseur bancaire abstrait derrière `BankingProvider` ;
- données bancaires brutes immuables côté client ;
- corrections utilisateur séparées ;
- RLS stricte ;
- Finance privée pendant les tests ;
- navigation responsive et routes réellement cliquables.

## Variables d’environnement

```env
# Finance — Lot 0
FINANCE_BANKING_PROVIDER=disabled
FINANCE_DEV_PREVIEW=true
FINANCE_PRIVATE_BETA_USER_IDS=
```

En local, `FINANCE_DEV_PREVIEW=true` permet à une utilisatrice authentifiée de voir Finance.
En production, cette variable n’ouvre rien : seuls les UUID Supabase listés dans `FINANCE_PRIVATE_BETA_USER_IDS` sont autorisés.

## Migration

`supabase/migrations/20260815190000_finance_foundation_v1.sql`

Elle crée :

- connexions et comptes Open Banking ;
- transactions bancaires source ;
- annotations transactionnelles ;
- catégories ;
- règles marchands ;
- profil financier ;
- cycles de paie ;
- enveloppes et mouvements cash ;
- objectifs ;
- engagements récurrents ;
- insights ;
- reçus webhook idempotents.

## Sécurité importante

Les tables `finance_connections`, `finance_accounts` et `finance_transactions` sont uniquement lisibles par leur propriétaire côté client. Leur écriture est réservée au backend `service_role`.

Cela empêche une interface cliente de réécrire le montant ou le libellé d’une transaction bancaire source. Les corrections sont enregistrées dans `finance_transaction_annotations`.

## Routes UX posées

- `/finances`
- `/finances/envelopes`
- `/finances/envelopes/[id]`
- `/finances/goals`
- `/finances/goals/[id]`
- `/finances/upcoming`
- `/finances/transactions`
- `/finances/transactions/[id]`
- `/finances/analysis`
- `/finances/nova`
- `/finances/cash`
- `/finances/card-free`
- `/finances/banking`

## Lot suivant

Brancher le premier fournisseur Open Banking en sandbox derrière `BankingProvider`, sans modifier le moteur Finance ni les pages consommatrices.
