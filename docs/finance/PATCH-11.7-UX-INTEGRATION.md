# Intégration Patch 11.7

- Vue d'ensemble :
  - retirer complètement le bloc « Qualité des données » ;
  - utiliser `FinanceUpcomingPreview` pour la carte « À venir ».

- Analyse :
  - remplacer les deux cartes statiques récurrences / opérations à confirmer
    par `FinanceAnalysisQuickLinks`.

- Transactions :
  - ajouter une colonne checkbox ;
  - maintenir un `Set<string>` de transactions sélectionnées ;
  - ajouter « Tout sélectionner » ;
  - rendre `FinanceTransactionsBulkActions` sous la liste ;
  - si `filter=uncategorized`, afficher uniquement les opérations sans catégorie fiable.

- Après catégorisation groupée :
  - recharger la liste ;
  - vider la sélection.

Aucune migration Supabase.
