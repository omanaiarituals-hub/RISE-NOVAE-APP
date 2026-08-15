# Finance Lot 3 — CRUD + dashboard dynamique

Ce lot transforme Enveloppes et Objectifs en fonctions réellement éditables.

## Enveloppes
- création
- modification
- suppression logique
- montant cible et montant déjà disponible
- type mensuel / cumulatif / temporaire / objectif / dette
- report au cycle suivant
- activation des espèces physiques
- priorité

Aucune enveloppe d'exemple n'est créée automatiquement.

## Objectifs
- création
- modification
- suppression logique
- types : épargne, sécurité, voyage, projet, dette, découvert, personnalisé
- cible, montant actuel, contribution mensuelle, échéance, priorité, statut

Aucun objectif de découvert n'est affiché ou créé par défaut.

## Dashboard
Le dashboard ne montre que les éléments réellement configurés.
- aucun objectif => état vide + CTA
- aucun découvert => aucun bloc découvert
- aucune enveloppe => état vide + CTA
- comptes synchronisés => solde bancaire disponible à l'affichage

Le calcul « disponible réellement » reste volontairement désactivé jusqu'au lot moteur budgétaire.
