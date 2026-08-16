NOVAÉ Finance — PATCH 11.2
Finalisation Enable Banking idempotente

Correction :
- le code callback Enable Banking est à usage unique ;
- NOVAÉ empêche désormais toute double finalisation côté navigateur ;
- le serveur vérifie si une session a déjà été enregistrée avant POST /sessions ;
- gestion de la course "Session is already authorized" si une requête concurrente vient de finaliser ;
- suppression du paramètre ?code= de l'URL après réussite afin qu'un refresh ne rejoue jamais le consentement.

Aucune migration Supabase.
Aucun paiement / virement.
