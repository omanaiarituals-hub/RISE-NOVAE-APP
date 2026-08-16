NOVAÉ Finance — PATCH 11.4
Correction Analyse après RAZ sandbox

Cause :
- le patch 11.3 avait introduit une Promise.all incohérente dans
  /api/finance/transactions/intelligence, provoquant un HTTP 500 ;
- après la RAZ, les annotations de test sont volontairement supprimées :
  les vraies transactions doivent être réanalysées une fois.

Correction :
- endpoint intelligence reconstruit proprement ;
- seules les transactions des comptes actifs/inclus sont prises en compte ;
- aucun ancien compte Powens sandbox ne peut alimenter la roue ;
- indicateur needs_analysis si des vraies opérations existent mais ne sont
  pas encore analysées.

Après déploiement :
1. ouvrir Finance > Analyse ;
2. cliquer une fois sur « Relancer l’analyse » ;
3. la roue doit se reconstruire uniquement avec les vraies opérations.

Aucune migration Supabase.
