NOVAÉ Finance — PATCH 11.3
RAZ sandbox + données réelles uniquement

Corrections :
- le dashboard ne compte plus les transactions d'anciens comptes désactivés ;
- l'analyse ne lit plus les annotations d'anciens comptes sandbox ;
- ajout d'une RAZ volontaire des données de test depuis Banque ;
- la RAZ supprime les anciennes connexions Powens et leurs transactions ;
- elle efface les analyses/récurrences/règles marchands/provisions/mouvements cash de test ;
- elle remet les montants courants des enveloppes/objectifs à zéro sans supprimer leurs définitions ;
- la connexion Enable Banking réelle et le profil Finance sont conservés ;
- après la RAZ, NOVAÉ relance automatiquement la synchronisation réelle.

Enable Banking :
- récupération des transactions avec `strategy=longest` ;
- pagination via continuation_key en conservant les paramètres ;
- diagnostics serveur limités au nombre de transactions/page (aucune donnée bancaire brute loggée).

Aucune migration Supabase.
Aucun paiement / virement.
