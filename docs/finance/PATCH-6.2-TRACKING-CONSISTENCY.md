# Finance Patch 6.2 — cohérence des modes

Source de vérité métier : `tracking_mode`.

- `spend`: le montant suivi représente la dépense du cycle. Budget - dépense = économie/dépassement.
- `accumulate`: le montant suivi représente l'épargne réellement constituée. Réalisé - prévu = objectif atteint/manquant/dépassé.
- `repay`: le montant suivi représente la progression du remboursement. Le découvert pourra ensuite être piloté depuis le solde bancaire de fin de cycle.

Le cash physique (`cash_balance`) reste un compteur séparé. Un retrait bancaire vers une enveloppe `spend` augmente le cash sans augmenter la dépense. Une dépense cash diminue le cash et augmente la dépense. Pour `accumulate`/`repay`, une injection augmente la progression et un retrait/décaissement la diminue.
