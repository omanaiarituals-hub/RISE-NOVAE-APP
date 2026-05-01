'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── DATA ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'menage',
    icon: '🧴',
    label: 'Maison Naturelle',
    color: '#7CB87A',
    bgColor: '#E8F5E8',
    tagline: 'Zéro chimie, zéro gaspillage',
    description: 'Remplace tes produits ménagers toxiques par des recettes naturelles. Moins de 5€ d\'ingrédients remplacent 15 flacons.',
    economy: 'Économie estimée : 30 à 50€/mois',
    astuces: [
      {
        title: 'Le vinaigre blanc, ton allié universel',
        content: 'Un litre à ~0,50€ remplace le nettoyant vitres, l\'anti-calcaire, le désinfectant WC et le liquide de rinçage lave-vaisselle. Dilue à 1/3 vinaigre + 2/3 eau dans un spray.',
        saving: '~8€/mois',
        health: 'Aucun perturbateur endocrinien',
        emoji: '🍶',
      },
      {
        title: 'Bicarbonate de soude multi-usage',
        content: 'Détachant textile, déodorisant réfrigérateur, récurant doux pour l\'évier et les casseroles. 1kg à 2€ en grande surface dure plusieurs mois. Bicarbonate alimentaire ou technique, pas pharmaceutique.',
        saving: '~6€/mois',
        health: 'Non toxique, biodégradable',
        emoji: '🧂',
      },
      {
        title: 'Acide citrique contre le calcaire',
        content: 'Détartre la machine à café, le chauffe-eau, la douche. Dilue 2 cuillères à soupe dans 1L d\'eau. 500g à moins de 3€ en pharmacie ou vrac. Plus efficace que les produits Calgon.',
        saving: '~5€/mois',
        health: '100% naturel, présent dans les citrons',
        emoji: '🍋',
      },
      {
        title: 'Savon noir liquide concentré',
        content: 'Nettoie les sols, la cuisine, le mobilier. Quelques cuillères dans un seau suffisent. Un flacon de 1L à 3€ remplace plusieurs bouteilles de nettoyant multi-surfaces.',
        saving: '~7€/mois',
        health: 'Base végétale, sans phosphates',
        emoji: '🫧',
      },
      {
        title: 'Éco-recharges : le réflexe indispensable',
        content: 'Pour les produits que tu achètes encore en magasin (liquide vaisselle, lessive), choisis systématiquement la recharge. En moyenne 40% moins cher au litre et 70% moins de plastique.',
        saving: '~10€/mois',
        health: 'Moins d\'emballages = moins d\'exposition aux plastifiants',
        emoji: '♻️',
      },
      {
        title: 'Recette spray tout-usage maison',
        content: 'Mélange 1/3 vinaigre blanc + 1/3 liquide vaisselle bio + 1/3 eau + 5 gouttes d\'huile essentielle tea tree. Nettoie, dégraisse et désinfecte toutes les surfaces en une seule bouteille.',
        saving: '~8€/mois',
        health: 'Tea tree : antibactérien naturel prouvé',
        emoji: '🌿',
      },
      {
        title: 'Canalisations sans produits chimiques',
        content: 'Verse ½ tasse de bicarbonate, puis 1 tasse de vinaigre blanc dans le siphon. Laisse agir 10 min puis rince à l\'eau très chaude. Remplace les déboucheurs comme Destop (3-5€ la bouteille).',
        saving: '~4€/2 mois',
        health: 'Évite les brûlures chimiques et vapeurs toxiques',
        emoji: '🚿',
      },
      {
        title: 'Linge : vinaigre comme assouplissant',
        content: 'Verse 2 bouchons de vinaigre blanc dans le compartiment assouplissant de ta machine. Le linge est doux, sans résidu, et les odeurs de moisi disparaissent. Coût : ~3 centimes par lavage.',
        saving: '~5€/mois',
        health: 'Élimine les résidus de lessive sur la peau',
        emoji: '👕',
      },
      {
        title: 'Crème à récurer naturelle',
        content: 'Mélange 3 cuillères de bicarbonate + un filet d\'eau chaude pour former une pâte. Applique sur les taches d\'évier, plaques de cuisson, robinetterie. Laisse 10 min, frotte, rince. Zéro rayure.',
        saving: '~3€/mois',
        health: 'Aucun chlore ni ammoniaque irritant',
        emoji: '✨',
      },
      {
        title: 'Anti-poussière meubles maison',
        content: 'Dans un spray vide : eau déminéralisée + même quantité de vinaigre blanc + 1 cuillère d\'huile d\'olive. L\'huile piège la poussière et nourrit le bois. Agite bien avant chaque utilisation.',
        saving: '~4€/mois',
        health: 'Aucun composé organique volatil (COV)',
        emoji: '🪵',
      },
    ],
  },
  {
    id: 'alimentation',
    icon: '🥗',
    label: 'Manger Sain',
    color: '#C4956A',
    bgColor: '#FFF5E8',
    tagline: 'Bien manger, pas cher',
    description: 'Manger sainement ne coûte pas plus cher — ça demande juste une organisation différente. Ces astuces peuvent réduire ton budget courses de 30 à 50%.',
    economy: 'Économie estimée : 60 à 90€/mois',
    astuces: [
      {
        title: 'Les légumineuses, protéines stars',
        content: 'Lentilles, pois chiches, haricots secs : 2 à 3€ le kilo pour 8 à 10 portions. Remplace la viande 2-3 fois par semaine. Riches en fibres, fer et protéines. Nutrition au top, budget divisé par 4.',
        saving: '~20€/mois',
        health: 'Réduisent le cholestérol, stabilisent la glycémie',
        emoji: '🫘',
      },
      {
        title: 'Légumes de saison : 30 à 50% moins cher',
        content: 'Un légume hors saison (importé) coûte 2 à 3 fois plus cher qu\'un légume de saison local. Affiche le calendrier des saisons sur ton frigo. Printemps : épinards, asperges. Hiver : poireaux, courges, carottes.',
        saving: '~15€/mois',
        health: 'Plus de vitamines car moins de transport et stockage',
        emoji: '🥕',
      },
      {
        title: 'Le batch cooking du dimanche',
        content: '2h de cuisine le dimanche = 5 soirs de repas prêts. Prépare une céréale, une légumineuse, 2-3 légumes rôtis. Budget : 15-20€ pour 4 personnes toute la semaine. Supprime les plats préparés et les livraisons.',
        saving: '~25€/mois',
        health: 'Contrôle total des ingrédients, zéro additif',
        emoji: '🫕',
      },
      {
        title: 'Planifier les menus avant les courses',
        content: 'Note les 5-7 repas de la semaine AVANT de faire ta liste. Vérifie d\'abord ce qu\'il reste dans tes placards. Cette discipline seule élimine 30 à 40% des achats impulsifs et réduit le gaspillage.',
        saving: '~20€/mois',
        health: 'Moins de stress, meilleure qualité nutritionnelle',
        emoji: '📝',
      },
      {
        title: 'Acheter en vrac les produits secs',
        content: 'Riz, pâtes, avoine, lentilles, fruits secs en vrac : économie de 30 à 50% vs emballés. Les magasins Biocoop, La Vie Claire et certains Leclerc ont des rayons vrac. Tu choisis la quantité exacte dont tu as besoin.',
        saving: '~15€/mois',
        health: 'Moins d\'emballages plastiques donc moins de microplastiques',
        emoji: '⚖️',
      },
      {
        title: 'Les œufs, meilleur rapport qualité-prix',
        content: 'Une boîte de 12 œufs plein air à ~3€ = 12 repas protéinés. Les œufs remplacent la viande dans de nombreuses recettes (omelette, quiche, œufs brouillés). 4 repas/semaine à base d\'œufs = gros gain sur la viande.',
        saving: '~12€/mois',
        health: 'Protéines complètes, choline, vitamines D et B12',
        emoji: '🥚',
      },
      {
        title: 'Congeler intelligemment',
        content: 'Pain qui vieillit → congèle en tranches. Viande en promo → congèle en portions. Légumes trop mûrs → congèle pour soupe. Plat cuisiné en trop → congèle immédiatement. Réduit le gaspillage de 70%.',
        saving: '~18€/mois',
        health: 'La congélation préserve 90% des nutriments',
        emoji: '🧊',
      },
      {
        title: 'DDM ≠ date de danger',
        content: 'La DDM (anciennement DLUO) = "date de durabilité minimale". Après cette date, le produit peut perdre un peu de goût ou de texture mais il n\'est PAS dangereux. Yaourts, pâtes, conserves : consommables bien après. Seule la DLC (viande, poisson frais) est impérative.',
        saving: '~10€/mois',
        health: 'Distinction cruciale : évite le gaspillage sans risque',
        emoji: '📅',
      },
      {
        title: 'Circuits courts et fin de marché',
        content: 'Les marchés 30 min avant la fermeture = prix divisés par 2 sur fruits et légumes pour écouler les invendus. Les AMAP (Association pour le Maintien d\'une Agriculture Paysanne) proposent des paniers hebdomadaires bio à prix coûtant.',
        saving: '~15€/mois',
        health: 'Produits sans pesticides, cueillis à maturité',
        emoji: '🛒',
      },
      {
        title: 'Poissons gras en conserve : trésors oubliés',
        content: 'Sardines, maquereaux, thon en conserve nature : ~1,50€ la boîte pour 2 portions. Source d\'oméga-3 parmi les plus concentrées. À consommer 2-3 fois par semaine. Bien meilleur marché que les filets frais.',
        saving: '~12€/mois',
        health: 'Oméga-3 : anti-inflammatoires, bons pour le cerveau',
        emoji: '🐟',
      },
    ],
  },
  {
    id: 'budget',
    icon: '💡',
    label: 'Budget & Énergie',
    color: '#7B6FA0',
    bgColor: '#EEE8F5',
    tagline: 'Chaque euro compte',
    description: 'En 2026, le pouvoir d\'achat recule. Ces astuces concrètes te permettent de récupérer 100 à 200€ par mois sans changer de vie.',
    economy: 'Économie estimée : 100 à 200€/mois',
    astuces: [
      {
        title: 'Audit de tes abonnements ce soir',
        content: 'Regarde tes relevés bancaires et liste TOUS tes prélèvements automatiques. Netflix, Spotify, salle de sport non fréquentée, magazines, apps oubliées… La plupart des foyers trouvent 30 à 80€ de dépenses fantômes à supprimer immédiatement.',
        saving: '~30-80€/mois',
        health: 'Moins de stress financier = meilleure santé mentale',
        emoji: '🔍',
      },
      {
        title: 'Chauffage : 19°C en journée, 16°C la nuit',
        content: 'Baisser de 1°C la température = -7% sur la facture de chauffage. À 19°C au lieu de 21°C en journée : économie de 15%. Investissement : un programmateur de thermostat (~30€) amorti en 2 mois.',
        saving: '~25€/mois en hiver',
        health: 'Dormir dans une pièce fraîche améliore la qualité du sommeil',
        emoji: '🌡️',
      },
      {
        title: 'Changer de fournisseur d\'énergie',
        content: 'Depuis février 2026, le tarif réglementé d\'électricité a baissé. Mais les offres alternatives peuvent être encore plus compétitives. Utilise le comparateur officiel energie-info.fr. Le changement est gratuit, sans coupure, en 10 minutes.',
        saving: '~20€/mois',
        health: 'Certains fournisseurs proposent 100% énergie renouvelable',
        emoji: '⚡',
      },
      {
        title: 'Téléphonie : le marché a chuté',
        content: 'Des forfaits 5G avec 100Go existent à 8-12€/mois chez Free, Bouygues, SFR en promo. Si tu paies plus de 20€/mois, tu surpayes. Change ou appelle ton opérateur pour renégocier — le service fidélisation a toujours des offres cachées.',
        saving: '~15-20€/mois',
        health: 'Moins de stress financier',
        emoji: '📱',
      },
      {
        title: 'La règle des 24h avant tout achat non essentiel',
        content: 'Avant d\'acheter quelque chose qui n\'est pas prévu (vêtement, gadget, deco), attends 24h. Statistiquement, 70% des envies disparaissent. Pour les achats au-delà de 50€, attends 72h. Simple mais dévastateur pour les achats impulsifs.',
        saving: '~40€/mois',
        health: 'Réduit le consumérisme émotionnel et l\'anxiété',
        emoji: '⏳',
      },
      {
        title: 'Vrac et grandes quantités pour les produits qui durent',
        content: 'Papier toilette, café, huile, farine, sucre : achète en grand conditionnement. Le prix au kilo chute de 20 à 40%. Un achat mensuel groupé au lieu de petites quantités hebdomadaires économise du temps et de l\'argent.',
        saving: '~20€/mois',
        health: 'Moins d\'emballages, moins de perturbateurs endocriniens',
        emoji: '📦',
      },
      {
        title: 'Applications anti-gaspi : Too Good To Go & co',
        content: 'Too Good To Go propose des paniers surprise de restaurants et boulangeries à 3-5€ (valeur réelle 10-15€). Phénix récupère les invendus des supermarchés. En France, des millions de repas sont sauvés chaque semaine. Télécharge, active les notifications.',
        saving: '~20€/mois',
        health: 'Souvent de la nourriture artisanale, moins transformée',
        emoji: '🛍️',
      },
      {
        title: 'Frigos et congélos : les réglages oubliés',
        content: 'Le frigo doit être réglé à 4°C, le congélateur à -18°C. Chaque degré en moins inutilement = +5% de conso électrique. Dégivre ton congélateur régulièrement : 3mm de givre = +30% de consommation. Nettoie les serpentins arrière 1 fois par an.',
        saving: '~8€/mois',
        health: 'Bonne température = meilleure conservation = moins de gaspillage',
        emoji: '🧊',
      },
      {
        title: 'Achats d\'occasion : le réflexe avant le neuf',
        content: 'Vinted, Leboncoin, Vide-dressing : avant tout achat (vêtement, électro, sport, jouets), cherche d\'abord en occasion. En moyenne 60-80% moins cher. La qualité ancienne est souvent supérieure au neuf actuel fabriqué pour durer moins.',
        saving: '~30€/mois',
        health: 'Moins de production = moins de pollution chimique textile',
        emoji: '👗',
      },
      {
        title: 'Coupons et cashback : l\'argent qui dort',
        content: 'Applications Shopmium, iGraal, Poulpeo : cashback sur tes courses habituelles. Fidélité Lidl Plus, Carrefour+, Intermarché : coupons personnalisés. 10 min par semaine pour activer les offres = 10 à 20€ récupérés sans rien changer.',
        saving: '~15€/mois',
        health: 'Temps récupéré vs stress de "pas les moyens"',
        emoji: '🏷️',
      },
    ],
  },
]

// ── COMPOSANT CARTE ASTUCE ────────────────────────────────────
function AstuceCard({ astuce, color }: { astuce: any; color: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        background: 'white',
        borderRadius: 16,
        padding: '16px',
        marginBottom: 10,
        border: `1px solid ${open ? color + '40' : 'rgba(26,26,26,0.06)'}`,
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        boxShadow: open ? `0 4px 20px ${color}20` : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{astuce.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.35, marginBottom: 4 }}>
            {astuce.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: color,
              background: color + '18', padding: '2px 8px', borderRadius: 20,
              letterSpacing: '0.05em',
            }}>
              💰 {astuce.saving}
            </span>
          </div>
        </div>
        <div style={{
          fontSize: 12,
          color: 'rgba(26,26,26,0.3)',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.25s ease',
          flexShrink: 0,
          marginTop: 2,
        }}>▼</div>
      </div>

      {/* Contenu développé */}
      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color}20` }}>
          <p style={{ fontSize: 13, color: '#4A4A4A', lineHeight: 1.75, marginBottom: 12 }}>
            {astuce.content}
          </p>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: '#F5FFF5', borderRadius: 10, padding: '10px 12px',
            border: '1px solid rgba(76,175,80,0.15)',
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>🌱</span>
            <span style={{ fontSize: 12, color: '#2A7A30', lineHeight: 1.5 }}>{astuce.health}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────
export default function AstucesPage() {
  const [activeCategory, setActiveCategory] = useState('menage')
  const cat = CATEGORIES.find(c => c.id === activeCategory)!

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>

<Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B6560', textDecoration: 'none', padding: '12px 20px', fontFamily: "'DM Sans', sans-serif" }}>
  ← Accueil
</Link>

      {/* HEADER */}
      <div style={{
        background: 'white',
        padding: '20px 20px 0',
        borderBottom: '1px solid rgba(196,149,106,0.1)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'rgba(26,26,26,0.35)',
              marginBottom: 4,
            }}>NOVAÉ · Astuces</div>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28, fontWeight: 500, color: '#1A1A1A', margin: 0, lineHeight: 1.2,
            }}>
              Vivre mieux,<br />dépenser moins
            </h1>
            <p style={{ fontSize: 13, color: '#6B6560', marginTop: 6, lineHeight: 1.6 }}>
              Des astuces concrètes pour 2026 — économie, santé, planète.
            </p>
          </div>

          {/* TABS CATÉGORIES */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid rgba(196,149,106,0.1)' }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                style={{
                  flex: 1,
                  padding: '12px 6px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeCategory === c.id ? `2.5px solid ${c.color}` : '2.5px solid transparent',
                  marginBottom: -2,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: activeCategory === c.id ? c.color : 'rgba(26,26,26,0.35)',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENU CATÉGORIE */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {/* Bandeau catégorie */}
        <div style={{
          background: cat.bgColor,
          borderRadius: 20,
          padding: '20px',
          marginBottom: 20,
          border: `1px solid ${cat.color}25`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 32 }}>{cat.icon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: cat.color, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                {cat.tagline}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#1A1A1A', fontWeight: 500 }}>
                {cat.label}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#4A4A4A', lineHeight: 1.7, marginBottom: 12 }}>
            {cat.description}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: cat.color, borderRadius: 20, padding: '6px 14px',
          }}>
            <span style={{ fontSize: 14 }}>💰</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{cat.economy}</span>
          </div>
        </div>

        {/* Compteur */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(26,26,26,0.35)', textTransform: 'uppercase' }}>
            {cat.astuces.length} astuces
          </span>
          <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.35)' }}>
            Clique pour développer ↓
          </span>
        </div>

        {/* Liste des astuces */}
        {cat.astuces.map((astuce, i) => (
          <AstuceCard key={i} astuce={astuce} color={cat.color} />
        ))}

        {/* Footer motivation */}
        <div style={{
          background: '#1A1A1A',
          borderRadius: 20,
          padding: '20px 24px',
          marginTop: 8,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18, color: 'white', lineHeight: 1.5, marginBottom: 6,
          }}>
            Chaque astuce appliquée est un pas vers ta souveraineté financière.
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            — NOVAÉ by OMANAÏA
          </p>
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  )
}