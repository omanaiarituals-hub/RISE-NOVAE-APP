# Finance Lot 4 — Nova recommandations et CRUD partagé

Le Lot 4 introduit une couche de recommandation séparée de l’IA générative : les calculs budgétaires sont déterministes, auditable et basés sur les données Finance disponibles.

Nova peut proposer des enveloppes et objectifs, mais leur création exige une confirmation explicite. Les montants restent modifiables avant et après validation.

Le point d’entrée `/api/finance/nova/crud` prépare l’orchestration future par le moteur conversationnel : toute création, modification ou suppression y exige `confirmed: true`.

Ce lot ne branche pas encore OpenAI. Il prépare les outils Finance que le futur moteur conversationnel pourra appeler de manière contrôlée.
