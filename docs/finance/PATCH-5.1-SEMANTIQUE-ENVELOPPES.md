# Finance — Patch 5.1

Ce correctif sépare quatre notions qui ne doivent plus être confondues :

1. **Budget cible** de l'enveloppe.
2. **Progression du cycle** : dépensé, injecté ou remboursé selon le type.
3. **Cash physique restant** dans l'enveloppe.
4. **Historique annuel** dérivé des mouvements, avec snapshots de cycles prêts pour la clôture.

Libellés UX :
- mensuelle/temporaire : « Montant déjà dépensé » ;
- cumulative/objectif : « Montant déjà injecté » ;
- dette/découvert : « Montant déjà remboursé ».

Une enveloppe physique mensuelle peut donc afficher simultanément :
- 220 € dépensés / 500 € de budget ;
- 180 € encore présents en espèces ;
- 1 940 € dépensés depuis le début de l'année.

Le retrait DAB n'est jamais une dépense. Il déplace seulement l'argent du compte vers `cash_balance`.
