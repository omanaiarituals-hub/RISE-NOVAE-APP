# NOVAÉ Finance — Lot 8 — Intelligence transactionnelle

## Objectif
Transformer les opérations bancaires synchronisées en informations financières exploitables, sans confier les calculs à une IA générative.

## Principes
- moteur déterministe côté serveur ;
- les corrections utilisateur ont toujours priorité ;
- une règle marchand validée peut être réappliquée aux opérations futures ;
- détection prudente des transferts internes par montant opposé sur deux comptes inclus ;
- détection des retraits, remboursements, revenus, abonnements, paiements fractionnés et récurrences ;
- les transactions Open Banking source ne sont jamais modifiées ; seules les annotations le sont ;
- aucune action de paiement ou virement.

## UX
- bouton d’analyse sur Transactions et Analyse ;
- catégorie + nature financière visibles dans la liste ;
- détail d’une transaction modifiable ;
- option « Retenir pour ce marchand » ;
- synthèse des récurrences et insights dans Analyse.

## Limites V1
Les heuristiques sont volontairement prudentes. Une opération ambiguë reste à confirmer plutôt que d’être classée avec une fausse certitude. Le Lot 9 exploitera ces annotations pour l’onboarding intelligent.
