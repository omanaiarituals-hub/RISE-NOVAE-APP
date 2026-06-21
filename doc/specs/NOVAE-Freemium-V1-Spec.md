# NOVAÉ Freemium V1 — Spec produit & business

**Date :** 12 mai 2026
**Status :** À implémenter avant le 1er juin 2026
**Owner :** Ness (nesserine Sediri)

---

## 🎯 Objectif

Lancer le modèle freemium de NOVAÉ le 1er juin 2026 avec :
- Une feature d'acquisition virale (scan-to-recipe + liste de courses)
- Un tier Premium clair, différencié et désirable
- Une transition douce et respectueuse pour les beta testers actuels
- Une architecture code qui supporte l'évolution future des tiers sans refacto

---

## 💰 1. Modèle économique

### 1.1 Tarification

| Offre | Prix TTC | Cible | Condition |
|---|---|---|---|
| Premium standard | **7,90€/mois** | Nouvelles abonnées post 1er juin | Trial 7j inclus |
| **Pionnière OMANAÏA** | **6,32€/mois** (-20%) | Beta testers + 200 premières abonnées avant 1er juin | Tarif bloqué à vie tant que l'abonnement reste actif |

### 1.2 Rentabilité par abonnée

**À 7,90€ TTC :**
- Brut : 7,90€
- − Stripe (1,4% + 0,25€) : −0,36€ → 7,54€
- − URSSAF micro-entrepreneur (~22%, à confirmer selon ton statut exact) : −1,66€ → 5,88€
- − Coût Anthropic API par Premium active : ~0,30€/mois
- **Net : ~5,40€/abonnée/mois**

**À 6,32€ TTC (Pionnière) :**
- Net : **~4,70€/abonnée/mois** — toujours rentable, valeur en advocacy compense largement la décote

### 1.3 Seuil de rentabilité

~12-15 abonnées Premium pour couvrir l'infra de lancement.

### 1.4 Anticipation TVA (pour plus tard)

Tant que le CA reste sous le seuil de franchise TVA micro-entrepreneur (à vérifier seuil 2026 exact), pas de TVA à collecter.

Si franchissement → 3 stratégies possibles :
- **A.** Absorber : 7,90€ reste mais net tombe à ~4,55€
- **B.** Répercuter : prix passe à 9,48€ (saute la barrière psychologique 9€)
- **C. Recommandé** : repricing à **8,90€ TTC** → net ~5,15€, reste sous 9€

### 1.5 Coûts infra par stade

| Stade | Users | Coût/mois | Action |
|---|---|---|---|
| Beta actuelle | <500 | ~1-25€ | Statu quo |
| Launch Premium (1er juin) | 200-1000 | ~30-50€ | **Vercel Pro obligatoire** + Brevo Lite |
| Growth | 1000-5000 | ~70-100€ | + Supabase Pro |
| Scale | 5000+ | 150€+ | Tout upgrade |

⚠️ **Vercel Hobby est interdit pour usage commercial** dans leurs ToS. Dès la monétisation = Vercel Pro obligatoire (~20€/mois).

---

## 🎨 2. Structure des tiers

### 2.1 Tier FREE (gratuit à vie)

✅ Onglet recettes : saisie manuelle illimitée + **5 scans IA/mois**
✅ Liste de courses générée automatiquement
✅ Planner / notes / tracking basique
✅ Streak quotidien + badges
✅ Page profil + paramètres
✅ Home + bibliothèque de contenus génériques

### 2.2 Tier TRIAL (7 jours gratuits)

Accès complet Premium pendant 7 jours, **sans CB obligatoire**.
Au jour 7 → bascule en FREE si pas d'abonnement.
Cap interne : 25 scans/semaine pour limiter exposition coût API en cas d'abus.

### 2.3 Tier PREMIUM (7,90€/mois ou 6,32€ Pionnière)

Tout le FREE +
- ✨ **Scan-to-recipe illimité**
- 🤖 IA Coach conversationnel illimité avec détection des contradictions
- 📅 reset 90 jours OMANAÏA débloqué
- 👯 Accès à la Communauté (posts, commentaires, défis, leaderboard)
- 📊 Débrief IA hebdomadaire (cron dimanche)
- 🔮 Cercle de la semaine (spotlight rotatif)
- 🎁 Contenus exclusifs Premium

---

## 🚪 3. Mécanique du trial

**Modèle adopté : C — Hybride avec hook "Pionnière à vie"**

### 3.1 Parcours utilisatrice

1. **Inscription** → trial 7 jours activé automatiquement, sans CB
2. **Jour 1** : email Brevo de bienvenue Premium + tour des features clés
3. **Jour 3** : email "Tu as testé X, voici ce qu'il te reste à explorer" + push
4. **Jour 6** : email *"Plus que 24h — bloque ton tarif Pionnière à -20% à vie"*
5. **Jour 7 matin** : push notification finale
6. **Jour 7 soir** : si pas d'abonnement → bascule en FREE + email *"Tu peux revenir quand tu veux"*

### 3.2 Hook conversion : "Pionnière OMANAÏA"

Pendant le trial, push fort :

> *"Tu fais partie des 200 premières à découvrir NOVAÉ.
> Bloque ton tarif à vie : 6,32€/mois au lieu de 7,90€ (-20% à vie).
> Réservé à celles qui s'abonnent avant le retour en plein tarif."*

La CB demandée à ce moment-là = **opportunité positive à saisir**, pas piège auto-bill.

Conversion estimée : 25-30%.

---

## 🌸 4. Transition des beta testers

### 4.1 Statuts possibles au 1er juin

| Statut | Action |
|---|---|
| Beta + s'abonne avant 1er juin | Tarif **Pionnière 6,32€/mois à vie** |
| Beta + ne s'abonne pas | Reste en **FREE** avec historique préservé |
| "Sœurs" choisies par Ness | **Premium manuel** débloqué via admin |

### 4.2 Communication beta (à envoyer fin mai)

Email de gratitude avec ton OMANAÏA = douceur + reconnaissance, **pas commerciale agressive**.

> *"Tu étais là dès le début. Pour te remercier de ta confiance, je te garde ton accès offert toute la vie sur certaines features, et je te propose ton tarif Pionnière à -20% à vie sur le Premium si tu veux continuer l'aventure complète. Quoi que tu choisisses, merci."*

Lien direct vers checkout Stripe avec tarif -20% pré-rempli.

### 4.3 Admin function (à créer)

```sql
-- Débloquer Premium manuellement (sœurs, cas particuliers, gifts)
UPDATE users
SET subscription_tier = 'premium',
    subscription_source = 'manual_admin',
    premium_started_at = NOW()
WHERE id = '<user_id>';
```

À exposer dans `/admin` avec une simple checkbox "Manual Premium override".

---

## 📸 5. Feature : Scan-to-Recipe + Liste de courses

### 5.1 Pourquoi cette feature est stratégique

Hook viral d'acquisition + valeur perçue forte.
**Démo TikTok** : *"Capture d'écran d'une recette → l'app remplit tout → liste de courses prête. En un clic."*

### 5.2 Spec technique

**Upload photo :**
- Champ `photo` dans le formulaire recette
- Upload vers Supabase Storage bucket `recipe-photos` (privé, RLS par user_id)
- Compression côté client avec `browser-image-compression` (max 1MB, 1200px)
- Path : `{user_id}/{recipe_id}.jpg`

**Extraction IA :**
- Endpoint Next.js `/api/recipes/extract`
- Reçoit l'image, l'envoie à **Claude Haiku 4.5 avec vision**
- Prompt structuré demandant un JSON :

```json
{
  "title": "string",
  "servings": "number",
  "ingredients": [
    {"name": "string", "quantity": "number", "unit": "string"}
  ],
  "steps": ["string"],
  "cooking_time_minutes": "number"
}
```

- Coût estimé : ~0,002€ par scan

**Auto-fill UX :**
- Form pré-rempli avec mention claire : *"✨ Extrait par IA — vérifie et corrige si besoin"*
- User valide → save en BDD
- Ingrédients tagués pour agrégation liste de courses

**Liste de courses :**
- Table `shopping_list_items` (user_id, recipe_id, ingredient_name_normalized, quantity, unit, checked)
- Table `ingredients_canonical` pour normalisation (tomate/tomates/tomate cerise → "tomate")
- **V1** : groupe par nom, garde l'unité d'origine
- **V2 (post-launch)** : conversion automatique grammes/ml

### 5.3 Quotas par tier

| Tier | Scans/mois |
|---|---|
| FREE | 5 |
| TRIAL | Illimité (cap interne 25/semaine anti-abus) |
| PREMIUM | Illimité |

### 5.4 Gestion des cas edge

- **Image multi-recettes** (genre 6 muffins en grille) → demander à user de cropper, ou extraire toutes avec choix
- **Image texte seul** → ça marche normalement
- **Image photo plat sans texte** → extraction pauvre, demander complétion manuelle
- **Échec parsing** → message clair *"On n'a pas pu lire cette image, ressaie ou remplis à la main"*

### 5.5 ⚠️ Avant la vidéo TikTok

**Tester le parsing sur 20-30 captures réelles** (Marmiton, 750g, captures Insta, photos de livres, fiches PDF). Si taux d'échec > 15% → ajuster le prompt avant de filmer. Promesse marketing > réalité produit = trust killer.

---

## 🏗️ 6. Architecture technique

### 6.1 Schema Supabase à ajouter

```sql
-- Extension table users
ALTER TABLE users ADD COLUMN subscription_tier TEXT
  CHECK (subscription_tier IN ('free', 'trial', 'premium', 'expired'))
  DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_source TEXT;
ALTER TABLE users ADD COLUMN trial_started_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN premium_price_locked DECIMAL(5,2);
ALTER TABLE users ADD COLUMN premium_started_at TIMESTAMPTZ;

-- Table quotas d'usage
CREATE TABLE user_quotas (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  scan_count_month INTEGER DEFAULT 0,
  scan_count_reset_at TIMESTAMPTZ,
  ai_chat_count_day INTEGER DEFAULT 0,
  ai_chat_reset_at TIMESTAMPTZ
);

-- Table recipes (si pas déjà existante)
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  servings INTEGER,
  cooking_time_minutes INTEGER,
  photo_url TEXT,
  source TEXT, -- 'manual' | 'ai_scan'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table ingrédients liés
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT, -- pour agrégation liste de courses
  quantity DECIMAL,
  unit TEXT
);

-- Table normalisation ingrédients (alimentée par toi + IA)
CREATE TABLE ingredients_canonical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT UNIQUE NOT NULL,
  aliases TEXT[] -- ['tomate', 'tomates', 'tomate cerise']
);
```

### 6.2 Helper centralisé `canAccess` (à créer en priorité)

```typescript
// lib/permissions.ts
type Feature =
  | 'scan_recipe'
  | 'ai_coach_unlimited'
  | 'program_90_days'
  | 'community_access'
  | 'weekly_debrief'
  | 'circle_of_week'
  | 'premium_content';

export async function canAccess(
  feature: Feature,
  userId: string
): Promise<{ allowed: boolean; reason?: string; quota_remaining?: number }> {
  const user = await getUser(userId);

  // Premium et trial → tout débloqué
  if (user.subscription_tier === 'premium' || user.subscription_tier === 'trial') {
    return { allowed: true };
  }

  // Free tier → gating selective
  switch (feature) {
    case 'scan_recipe': {
      const quota = await getUserQuota(userId);
      return {
        allowed: quota.scan_count_month < 5,
        quota_remaining: 5 - quota.scan_count_month,
        reason: quota.scan_count_month >= 5 ? 'monthly_limit_reached' : undefined
      };
    }
    case 'ai_coach_unlimited':
    case 'program_90_days':
    case 'community_access':
    case 'weekly_debrief':
    case 'circle_of_week':
    case 'premium_content':
      return { allowed: false, reason: 'premium_required' };
    default:
      return { allowed: true };
  }
}
```

👉 Chaque feature de l'app appelle `canAccess()` au lieu de checker `if (user.is_premium)` partout. C'est LA décision archi qui te sauve des semaines de refacto plus tard.

### 6.3 Composants UI à créer

- `<PaywallModal />` — modal qui s'affiche quand `canAccess` retourne `allowed: false` (`reason: 'premium_required'`)
- `<TrialBanner />` — bandeau persistent "Plus que X jours dans ton essai"
- `<QuotaIndicator />` — affiche "3/5 scans utilisés ce mois" sur l'onglet recettes
- `<PionniereOffer />` — composant promo -20% à vie, affiché pendant trial et aux beta avant 1er juin

---

## 🗓️ 7. Roadmap d'exécution (12 mai → 1er juin)

### Sprint 1 — Foundation (12-15 mai, ~3 jours)
- [ ] **Demain matin priorité 1** : envoyer les 10 emails d'excuses aux beta testers
- [ ] Corriger duplicate streak (🔥) — retirer du programme card, garder `user_streaks`
- [ ] Fixer broken community CTA dans email Brevo #16
- [ ] Tester cron 18h UTC streak-reminder
- [ ] Clarifier "tableau 10.4" pour Sunday review
- [ ] Schema Supabase : `subscription_tier`, `user_quotas`, `recipes`, `recipe_ingredients`, `ingredients_canonical`
- [ ] Implémenter `canAccess()` helper centralisé

### Sprint 2 — Scan-to-Recipe + Shopping List (16-20 mai, ~5 jours)
- [ ] Bucket Supabase Storage `recipe-photos` + RLS par user_id
- [ ] Composant upload photo dans form recette (avec compression client-side)
- [ ] API route `/api/recipes/extract` avec Claude Haiku 4.5 vision
- [ ] Parser ingrédients + table de normalisation
- [ ] UI auto-fill avec mention claire "extrait par IA, vérifie"
- [ ] Table + UI liste de courses agrégée
- [ ] **Tests sur 20-30 captures réelles** avant tournage vidéo

### Sprint 3 — Vidéo + push acquisition (21-23 mai, ~3 jours)
- [ ] Filmer démo "scan-to-recipe one-click" pour TikTok/IG
- [ ] Préparer 3 angles : démo brute, témoignage anonyme, voix Lady Whistledown
- [ ] Publier sur TikTok + IG + adapter pour Pinterest

### Sprint 4 — Stripe Premium (24-28 mai, ~4-5 jours)
- [ ] Setup Stripe + webhook handler (`/api/stripe/webhook`)
- [ ] Checkout page (standard 7,90€ + Pionnière 6,32€)
- [ ] Customer portal Stripe
- [ ] Composants `<PaywallModal />`, `<TrialBanner />`, `<QuotaIndicator />`, `<PionniereOffer />`
- [ ] Séquence email Brevo trial (J1, J3, J6, J7)
- [ ] Tests paiements complets en mode staging

### Sprint 5 — Beta transition + launch (29-31 mai, ~2-3 jours)
- [ ] Email gratitude beta testers avec offre Pionnière
- [ ] Admin function "débloquer Premium manuel" dans `/admin`
- [ ] **Souscrire Vercel Pro** (obligatoire avant monétisation)
- [ ] Souscrire Brevo Lite si volume email le justifie
- [ ] Admin dashboard métriques V1 (KPIs simples : counts free / trial / premium)

### 🚀 1er juin — Launch officiel Premium

---

## ✅ 8. Décisions verrouillées (à ne plus rebattre)

- ✅ Prix Premium : **7,90€/mois** (Pionnière 6,32€)
- ✅ Trial : **7 jours, sans CB obligatoire**
- ✅ Hook conversion : offre **Pionnière -20% à vie**, réservée 200 premières
- ✅ Scan-to-recipe : **5/mois en free**, illimité Premium
- ✅ **Communauté : Premium-only**
- ✅ **Reset 90j : Premium-only**
- ✅ IA Coach : limité en free, illimité Premium
- ✅ Beta testers actuels : peuvent souscrire au tarif Pionnière, sinon restent en free (historique préservé)
- ✅ Architecture : champ `subscription_tier` + helper `canAccess` centralisé

---

## ⚠️ 9. Points d'attention (anti-perfectionnisme)

1. **La V1 doit fonctionner sur 80% des cas, pas 100%.** La normalisation parfaite des ingrédients, l'agrégation par unité, la gestion multi-recettes parfaite → V2 post-launch.
2. **Tester le parsing avant de filmer la vidéo TikTok.** Si taux d'échec > 15%, ajuster le prompt avant communication marketing.
3. **Vercel Pro non négociable** dès la monétisation.
4. **Communication beta = empathie + reconnaissance**, jamais commerciale agressive.
5. **Cap interne sur le trial** (max 25 scans/semaine) pour limiter exposition coût API en cas d'abus.
6. **Ne pas glisser sur le scope.** Si une nouvelle idée surgit pendant le sprint → noter dans `/docs/ideas-v2.md` et continuer.

---

## 📊 10. Métriques à tracker dès le launch

- Nb d'inscriptions / jour
- Conversion FREE → TRIAL (auto, tout le monde)
- Conversion TRIAL → PREMIUM (objectif : 25-30%)
- Répartition Pionnière vs Premium standard
- Nb de scans / user / mois (free vs premium)
- Churn mensuel Premium
- Coût API total / mois vs revenus
- MRR (Monthly Recurring Revenue)
- NPS / feedback qualitatif

---

*Document généré le 12 mai 2026 — à versionner dans `NOVAE-APP/docs/specs/freemium-v1.md` pour traçabilité.*
