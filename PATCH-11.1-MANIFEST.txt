NOVAÉ Finance — PATCH 11.1
Enable Banking réel personnel / production restreinte

Ajouts :
- provider Enable Banking en lecture seule ;
- JWT RS256 signé côté serveur avec la clé privée de l'application ;
- parcours POST /auth -> callback -> POST /sessions ;
- récupération sessions, comptes, soldes et transactions ;
- pagination continuation_key ;
- archivage local des anciens comptes sandbox Powens après première synchro réelle ;
- interface Banque adaptée au provider actif ;
- aucun paiement, virement ou Payment Initiation Service.

Variables serveur :
FINANCE_BANKING_PROVIDER=enable_banking
ENABLE_BANKING_APPLICATION_ID=
ENABLE_BANKING_PRIVATE_KEY_BASE64=
ENABLE_BANKING_ASPSP_NAME=Crédit Agricole Sud Rhône-Alpes
ENABLE_BANKING_ASPSP_COUNTRY=FR
ENABLE_BANKING_PSU_TYPE=personal
ENABLE_BANKING_CONSENT_DAYS=90
ENABLE_BANKING_REDIRECT_URL=https://app.novae-by-omanaia.com/finances/banking

Sécurité :
- ne jamais exposer la clé privée dans le navigateur ;
- ne jamais la committer dans Git ;
- le provider ne contient aucune méthode de paiement/virement.
