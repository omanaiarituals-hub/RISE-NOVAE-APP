NOVAÉ Finance — PATCH 11.5
Correction Supabase 400 sur l'analyse réelle

Diagnostic confirmé par les logs Vercel :
- finance_accounts : OK
- finance_transactions : OK
- finance_transaction_annotations : HTTP 400

Cause corrigée :
- le endpoint envoyait plusieurs centaines d'UUID dans un filtre PostgREST
  `.in(transaction_id, [...])`, ce qui rendait la requête trop volumineuse.

Correction :
- chargement des annotations du seul utilisateur ;
- filtrage côté serveur NOVAÉ avec un Set des transactions appartenant aux
  comptes réels actifs/inclus ;
- aucune donnée Powens sandbox ne peut être réinjectée ;
- aucune modification de schéma / aucune migration Supabase.

Après déploiement :
1. ouvrir Finance > Analyse ;
2. cliquer une fois sur « Relancer l’analyse » si nécessaire ;
3. vérifier la roue et le détail des catégories ;
4. vérifier Nova.
