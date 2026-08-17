NOVAÉ Finance — PATCH 11.7.2
CORRECTIF D'INTÉGRATION UX

Pourquoi 11.7 ne changeait visuellement rien :
- les nouveaux composants avaient été ajoutés au projet,
- mais ils n'avaient pas été branchés dans les pages/composants déjà affichés.
Le 11.7.2 modifie cette fois les composants réels utilisés par l'application.

Intégration effective :
1. Vue d'ensemble
   - suppression réelle de « Qualité des données » ;
   - remplacement réel de la carte statique « À venir » par les 3 prochains prélèvements/charges.

2. Transactions
   - cases à cocher visibles sur chaque ligne ;
   - « Tout sélectionner » ;
   - barre d'action groupée ;
   - choix de catégorie + catégorisation de la sélection ;
   - filtre `?filter=uncategorized` réellement appliqué.

3. Analyse
   - insight « Dépenses récurrentes détectées » cliquable vers À venir ;
   - insight « opérations à confirmer / catégoriser » cliquable vers Transactions filtrées ;
   - récurrences affichées également cliquables.

4. API bulk
   - utilise le vrai schéma `finance_transaction_annotations` ;
   - conserve la nature financière existante ;
   - marque la correction comme utilisateur.

Aucune migration Supabase.
Aucun paiement / virement.
