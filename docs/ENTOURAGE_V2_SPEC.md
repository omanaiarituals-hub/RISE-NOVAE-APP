# NOVAÉ — Entourage V2
## Spécification fonctionnelle validée — 4 août 2026

## 1. Vision

Le module « Famille » évolue vers **Entourage**.

Il ne doit pas devenir un second carnet de contacts. Sa fonction est de fournir à Nova le contexte humain utile pour comprendre la vie personnelle et professionnelle de l’utilisatrice, puis relier ce contexte au Planner, aux tâches, aux rappels, aux repas, aux documents et aux trajets.

Principe central :

- le téléphone conserve les coordonnées ;
- NOVAÉ conserve le contexte relationnel ;
- Nova enrichit progressivement les fiches au fil des conversations ;
- aucune information durable n’est enregistrée silencieusement ;
- toute création ou modification importante demande une validation explicite.

## 2. Catégories principales

Chaque personne possède un cercle principal :

- **Foyer**
- **Famille**
- **Proches**
- **Professionnel**

Une personne peut également appartenir à plusieurs cercles secondaires.

## 3. Types de fiches

### Foyer et enfants — fiche complète

- prénom ;
- nom ;
- lien avec l’utilisatrice ;
- date de naissance ;
- photo ou initiales ;
- présence dans le foyer ;
- mode de garde ;
- allergies ;
- informations médicales utiles ;
- école, crèche, collège ou lycée ;
- classe ou niveau ;
- activités ;
- personnes autorisées à récupérer l’enfant ;
- contacts d’urgence ;
- médecins et spécialistes ;
- lieux fréquents ;
- notes utiles.

### Famille et proches — fiche intermédiaire

- prénom et nom ;
- relation ;
- anniversaire ;
- adresse ou ville ;
- idées cadeaux ;
- préférences utiles ;
- rappels associés ;
- événements importants ;
- notes de contexte.

### Professionnel — fiche légère

- prénom et nom ;
- rôle ;
- entreprise ;
- lien professionnel ;
- contexte utile ;
- événements ou tâches liés.

Aucune obligation de recopier les coordonnées déjà présentes dans le téléphone.

## 4. Création et enrichissement par Nova

Nova peut détecter une personne citée dans une conversation.

Exemple :

> « J’ai rendez-vous avec Sophie, ma responsable RH, jeudi. »

Nova peut proposer :

> « Tu veux que je retienne que Sophie est ta responsable RH pour les prochaines demandes ? »

Après validation, Nova crée une fiche légère :

- nom : Sophie ;
- cercle : Professionnel ;
- rôle : responsable RH.

Elle ne doit pas créer automatiquement une fiche pour chaque prénom entendu.

Si plusieurs personnes correspondent, Nova demande laquelle est concernée.

## 5. Mode de garde

Le module doit gérer :

- une semaine sur deux ;
- week-ends alternés ;
- jours fixes ;
- semaine coupée ;
- garde personnalisée ;
- présence ponctuelle ;
- vacances scolaires ;
- date de départ de la récurrence ;
- heures de récupération et de remise ;
- exceptions ;
- échanges de semaines ;
- nuit supplémentaire ;
- suspension temporaire.

Nova ne modifie jamais la garde sans validation.

## 6. Bandeau dans le Planner

Le Planner doit afficher un contexte familial discret, non bloquant :

- Enfants avec moi ;
- Sans les enfants ;
- Transition de garde ;
- Récupération à 19 h ;
- Départ chez l’autre parent à 14 h.

Règles :

- la présence des enfants ne bloque pas automatiquement la journée ;
- elle sert de contexte pour Nova ;
- elle peut influencer les repas, les quantités, les trajets, les rendez-vous et les rappels ;
- la vue semaine utilise un bandeau léger ;
- la vue mois utilise un repère compact ;
- l’affichage doit pouvoir être masqué.

## 7. Anniversaires et rappels

Chaque anniversaire peut générer un événement annuel.

Rappels proposés :

- J-30 facultatif ;
- J-14 facultatif ;
- J-7 pour le cadeau ;
- J-2 pour l’organisation ;
- Jour J.

Le réglage minimal recommandé :

- J-7 : proposer une tâche « Acheter le cadeau » ;
- Jour J : rappel d’anniversaire.

Nova ne crée jamais automatiquement la tâche cadeau sans validation.

## 8. Santé et spécialistes

Pour chaque membre du foyer ou proche concerné :

- médecin traitant ;
- pédiatre ;
- dentiste ;
- orthodontiste ;
- ophtalmologue ;
- autre spécialiste ;
- pharmacie ;
- téléphone ;
- adresse complète, ville ou code postal ;
- personne concernée ;
- notes utiles.

L’adresse exacte reste facultative.

## 9. Lieux et trajets

Lieux récurrents possibles :

- domicile ;
- travail ;
- école ;
- crèche ;
- activité ;
- médecin ;
- spécialiste ;
- autre lieu fréquent.

Données possibles :

- nom du lieu ;
- adresse complète, ville ou code postal ;
- personne concernée ;
- mode de transport ;
- temps de trajet manuel ;
- marge de sécurité ;
- futur temps de trajet calculé par une API cartographique.

Nova doit détecter les rendez-vous trop serrés, enchaînements impossibles et récupérations irréalistes, puis proposer un horaire réaliste sans modifier le planning sans validation.

## 10. Connexions avec les autres modules

### Planner

Présence des enfants, transitions de garde, anniversaires, rendez-vous médicaux, activités, lieux et trajets.

### Repas

Nombre réel de personnes présentes, allergies et préférences.

### Liste de courses

Quantités adaptées au foyer présent.

### To-do

Cadeaux, inscriptions, documents scolaires, rendez-vous à prendre et affaires à préparer.

### Documents

Ordonnances, certificats, inscriptions, attestations et dossiers liés à une personne.

### Nova

Nova doit comprendre naturellement :

- « Ajoute le rendez-vous d’Inaya chez l’orthodontiste. »
- « Pense à l’anniversaire de ma mère. »
- « Planifie un point avec Sophie jeudi. »
- « Les filles sont avec moi de mercredi soir à samedi après-midi. »
- « Vendredi midi, prépare quelque chose de rapide pour nous quatre. »

## 11. Confidentialité et validation

- aucune information durable enregistrée silencieusement ;
- aucune modification de garde sans confirmation ;
- aucune action Planner, tâche ou rappel sans validation ;
- les données santé restent limitées au strict nécessaire ;
- l’adresse exacte est facultative ;
- les contacts professionnels restent légers ;
- les coordonnées du téléphone ne sont jamais importées automatiquement ;
- si plusieurs personnes ont le même prénom, Nova demande confirmation.

## 12. Ordre de réalisation

1. modèle de données Entourage ;
2. migration des fiches existantes du module Famille ;
3. catégories et cercles ;
4. cartes personnes ;
5. mode de garde et exceptions ;
6. lecture du contexte par Nova ;
7. bandeau Planner ;
8. anniversaires et rappels ;
9. santé et spécialistes ;
10. lieux et trajets ;
11. future liaison facultative avec les contacts du téléphone.

## 13. Premier lot recommandé

Le premier lot doit rester limité à :

- écran Entourage ;
- cartes personnes ;
- cercle principal ;
- appartenance au foyer ;
- relation ;
- date de naissance facultative ;
- mode de garde ;
- exceptions de garde ;
- lecture par Nova ;
- affichage du bandeau dans le Planner.

Les médecins, spécialistes, rappels cadeaux, trajets et contacts professionnels enrichis viennent ensuite.

## 14. Critères de réussite

Le lot est validé lorsque :

- une personne peut être créée et classée ;
- un enfant peut être déclaré membre du foyer ;
- une règle de garde peut être configurée ;
- une exception peut être ajoutée sans écraser la règle ;
- Nova peut lire la présence réelle des enfants ;
- le Planner affiche les jours avec enfants ;
- Nova adapte une proposition de repas au nombre de personnes présentes ;
- aucune modification n’est écrite sans validation explicite ;
- les anciennes données Famille restent conservées.
