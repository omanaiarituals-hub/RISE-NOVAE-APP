# Lot 10 — Nova Finance avancée

Ce lot transforme Nova Finance en outil de simulation et d'arbitrage, sans déléguer les calculs à un modèle génératif.

Principes:
- les scénarios ne modifient aucune donnée;
- le « réellement disponible » reste calculé à partir du moteur Finance;
- l'arbitrage respecte la priorité définie par l'utilisateur et les cibles mensuelles;
- à priorité égale, un objectif de remboursement est proposé avant une accumulation;
- un objectif sans cible mensuelle ni date cible n'est pas arbitré automatiquement;
- les recalibrages d'enveloppes nécessitent plusieurs ajustements observés et une confirmation explicite;
- aucun paiement, virement ou mouvement bancaire n'est initié.
