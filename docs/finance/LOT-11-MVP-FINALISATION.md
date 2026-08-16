# NOVAÉ Finance — Lot 11 — Finitions MVP

Ce lot clôt la série de gros lots Finance avant la phase de validation globale et de sécurisation séparée.

## Changements

### Dashboard
- état de chargement explicite;
- erreur récupérable avec bouton Réessayer;
- bloc « Qualité des données » : comptes inclus, nombre d'opérations, dernière synchronisation;
- CTA vers la banque quand aucune donnée bancaire n'est disponible;
- bouton « Simuler une décision » relié à Nova Finance avancée.

### Transactions
- bouton d'analyse désactivé quand aucune opération n'est disponible;
- état vide avec action directe vers la gestion bancaire.

### Espèces
- validation côté interface avant une dépense supérieure au cash disponible;
- validation serveur conservée et erreurs métier rendues compréhensibles;
- aucun débit bancaire supplémentaire lors d'une dépense cash.

## Critères de validation
1. Dashboard se charge sans écran vide et affiche les indicateurs de données.
2. Sans banque, un CTA permet d'aller vers Banque.
3. Avec banque, le nombre de comptes et d'opérations est cohérent.
4. « Simuler une décision » ouvre `/finances/nova`.
5. Transactions vide affiche une action vers Banque.
6. Une dépense cash supérieure au cash disponible est bloquée avant envoi.
7. Une dépense cash valide continue à diminuer uniquement le cash et augmente le dépensé du cycle.
8. Typecheck + build passent.
