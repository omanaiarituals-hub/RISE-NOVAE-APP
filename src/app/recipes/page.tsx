'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

// ─── TYPES ────────────────────────────────────────────────────────────────────
type MealType = 'entree' | 'plat' | 'dessert' | 'accompagnement' | 'boisson'
type Category = 'express' | 'healthy' | 'family' | 'vegetarian' | 'vegan' | 'gourmet'
type Difficulty = 'facile' | 'moyen' | 'difficile'
type PlanSlot = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation'

interface Ingredient { name: string; quantity: string }

interface Recipe {
  id: string
  user_id?: string
  title: string
  emoji: string
  description?: string
  prep_time: string
  cook_time: string
  category: Category
  meal_type: MealType
  difficulty: Difficulty
  servings: number
  ingredients: Ingredient[]
  steps: string[]
  is_favorite: boolean
  is_public?: boolean
  calories?: number
}

interface MealSlot {
  id: string
  recipe_id: string
  day_of_week: string
  meal_type: PlanSlot
  recipe?: Recipe
}

interface ShoppingItem {
  id: string
  ingredient: string
  quantity?: string
  unit?: string
  recipe_id?: string
  checked: boolean
  in_stock: boolean
  to_buy: boolean
  category?: string
  recipe_title?: string
  is_custom?: boolean
}

interface AllergyAlert {
  personName: string
  allergen: string
  recipeTitle: string
  day: string
  slot: string
}

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  cream: '#FAF7F2', rose: '#C4956A', roseLight: 'rgba(196,149,106,0.1)',
  violet: '#7B6FA0', noir: '#2C2C2C', gris: '#6B6B6B', grisClair: '#E8E4DF', blanc: '#FFFFFF',
}

const MEAL_TYPE_COLORS: Record<MealType, { bg: string; border: string; text: string; label: string }> = {
  entree:        { bg: 'rgba(144,200,168,0.15)', border: '#90C8A8', text: '#2A6A48', label: 'Entrée' },
  plat:          { bg: 'rgba(196,149,106,0.15)', border: '#C4956A', text: '#7A4A1A', label: 'Plat' },
  dessert:       { bg: 'rgba(224,160,184,0.15)', border: '#E0A0B8', text: '#8A3050', label: 'Dessert' },
  accompagnement:{ bg: 'rgba(160,190,220,0.15)', border: '#A0BED8', text: '#2C5F8A', label: 'Accomp.' },
  boisson:       { bg: 'rgba(180,160,220,0.15)', border: '#B4A0DC', text: '#5A3A8A', label: 'Boisson' },
}

const CATEGORY_COLORS: Record<Category, { bg: string; text: string; label: string }> = {
  express:    { bg: '#E8E4DF', text: '#6B6B6B', label: 'Express' },
  healthy:    { bg: 'rgba(144,200,168,0.2)', text: '#2A6A48', label: 'Healthy' },
  family:     { bg: 'rgba(196,149,106,0.15)', text: '#7A4A1A', label: 'Familial' },
  vegetarian: { bg: 'rgba(120,200,120,0.2)', text: '#2A6A20', label: 'Végétarien' },
  vegan:      { bg: 'rgba(80,180,80,0.2)', text: '#1A5A10', label: 'Vegan' },
  gourmet:    { bg: 'rgba(200,160,220,0.2)', text: '#6A2A8A', label: 'Gourmet' },
}

const PLAN_SLOTS: { key: PlanSlot; label: string }[] = [
  { key: 'petit_dejeuner', label: 'Petit-déj' },
  { key: 'dejeuner', label: 'Déjeuner' },
  { key: 'diner', label: 'Dîner' },
  { key: 'collation', label: 'Collation' },
]

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const EMOJIS = ['🥗','🍝','🥩','🐟','🍲','🥘','🫕','🥙','🌮','🍰','🎂','🍮','🥧','🍜','🍛','🍣','🥚','🥦','🍳','🧆']

const DEFAULT_RECIPES = [
  {
    title: 'Salade César', emoji: '🥗', description: 'La classique salade américaine revisitée',
    prep_time: '15', cook_time: '10', category: 'healthy' as Category, meal_type: 'entree' as MealType,
    difficulty: 'facile' as Difficulty, servings: 2, is_favorite: true, is_public: true, calories: 320,
    ingredients: [{ name: 'Laitue romaine', quantity: '1 tête' }, { name: 'Poulet grillé', quantity: '200g' }, { name: 'Parmesan', quantity: '50g' }, { name: 'Croûtons', quantity: '100g' }, { name: 'Sauce César', quantity: '4 cs' }],
    steps: ['Laver et couper la laitue en morceaux', 'Griller le poulet 10 min et trancher', 'Râper le parmesan', 'Assembler et napper de sauce César', 'Ajouter les croûtons et servir'],
  },
  {
    title: 'Pâtes Carbonara', emoji: '🍝', description: 'La vraie recette romaine sans crème',
    prep_time: '10', cook_time: '15', category: 'express' as Category, meal_type: 'plat' as MealType,
    difficulty: 'moyen' as Difficulty, servings: 4, is_favorite: false, is_public: true, calories: 520,
    ingredients: [{ name: 'Spaghetti', quantity: '400g' }, { name: 'Lardons fumés', quantity: '150g' }, { name: 'Œufs entiers', quantity: '3' }, { name: 'Jaunes d\'œuf', quantity: '2' }, { name: 'Parmesan râpé', quantity: '80g' }, { name: 'Poivre noir', quantity: 'PM' }],
    steps: ['Cuire les pâtes al dente dans eau salée', 'Faire revenir les lardons sans matière grasse', 'Mélanger œufs, jaunes et parmesan', 'Égoutter les pâtes en gardant un peu d\'eau', 'Hors feu, mélanger pâtes + lardons + mélange œufs', 'Poivrer généreusement, servir aussitôt'],
  },
  {
    title: 'Tiramisu', emoji: '🍮', description: 'Le dessert italien incontournable',
    prep_time: '30', cook_time: '0', category: 'gourmet' as Category, meal_type: 'dessert' as MealType,
    difficulty: 'moyen' as Difficulty, servings: 6, is_favorite: true, is_public: true, calories: 380,
    ingredients: [{ name: 'Mascarpone', quantity: '500g' }, { name: 'Œufs', quantity: '4' }, { name: 'Sucre', quantity: '100g' }, { name: 'Boudoirs', quantity: '200g' }, { name: 'Café fort refroidi', quantity: '200ml' }, { name: 'Cacao en poudre', quantity: '2 cs' }],
    steps: ['Séparer blancs et jaunes', 'Battre jaunes + sucre jusqu\'à blanchiment', 'Incorporer le mascarpone', 'Monter les blancs en neige ferme', 'Incorporer délicatement les blancs', 'Tremper rapidement les boudoirs dans le café', 'Alterner couches biscuits et crème', 'Réfrigérer 4h minimum, saupoudrer de cacao'],
  },
  {
    title: 'Poulet rôti citron-thym', emoji: '🥩', description: 'Un classique familial parfumé',
    prep_time: '10', cook_time: '60', category: 'family' as Category, meal_type: 'plat' as MealType,
    difficulty: 'facile' as Difficulty, servings: 4, is_favorite: true, is_public: true, calories: 420,
    ingredients: [{ name: 'Poulet entier', quantity: '1.5kg' }, { name: 'Citron', quantity: '2' }, { name: 'Thym frais', quantity: '4 branches' }, { name: 'Ail', quantity: '4 gousses' }, { name: 'Huile d\'olive', quantity: '3 cs' }, { name: 'Sel et poivre', quantity: 'PM' }],
    steps: ['Préchauffer le four à 200°C', 'Frotter le poulet avec huile, sel, poivre', 'Farcir avec citron coupé, thym et ail', 'Enfourner 1h en arrosant toutes les 20 min', 'Laisser reposer 10 min avant de découper'],
  },
  {
    title: 'Soupe à l\'oignon gratinée', emoji: '🍲', description: 'La soupe réconfortante par excellence',
    prep_time: '15', cook_time: '45', category: 'family' as Category, meal_type: 'entree' as MealType,
    difficulty: 'facile' as Difficulty, servings: 4, is_favorite: false, is_public: true, calories: 280,
    ingredients: [{ name: 'Oignons', quantity: '1kg' }, { name: 'Bouillon de bœuf', quantity: '1.5L' }, { name: 'Beurre', quantity: '40g' }, { name: 'Farine', quantity: '1 cs' }, { name: 'Vin blanc', quantity: '10cl' }, { name: 'Gruyère râpé', quantity: '150g' }, { name: 'Pain de campagne', quantity: '4 tranches' }],
    steps: ['Émincer finement les oignons', 'Les faire fondre 30 min dans le beurre à feu doux', 'Saupoudrer de farine, mélanger', 'Ajouter vin blanc puis bouillon', 'Mijoter 15 min', 'Verser dans bols, poser pain + gruyère', 'Gratiner 5 min sous le grill'],
  },
  {
    title: 'Buddha Bowl végétarien', emoji: '🥗', description: 'Un repas complet et coloré',
    prep_time: '20', cook_time: '20', category: 'vegetarian' as Category, meal_type: 'plat' as MealType,
    difficulty: 'facile' as Difficulty, servings: 2, is_favorite: false, is_public: true, calories: 450,
    ingredients: [{ name: 'Quinoa', quantity: '120g' }, { name: 'Pois chiches', quantity: '200g' }, { name: 'Avocat', quantity: '1' }, { name: 'Concombre', quantity: '1/2' }, { name: 'Carottes râpées', quantity: '100g' }, { name: 'Épinards frais', quantity: '50g' }, { name: 'Tahini', quantity: '2 cs' }, { name: 'Citron', quantity: '1' }],
    steps: ['Cuire le quinoa 15 min', 'Rôtir les pois chiches au four 20 min avec épices', 'Couper avocat et concombre', 'Préparer la sauce tahini-citron', 'Assembler tous les éléments dans un bol', 'Arroser de sauce et servir'],
  },
  {
    title: 'Omelette jambon-fromage', emoji: '🥚', description: 'Le classique du petit-déjeuner rapide',
    prep_time: '5', cook_time: '5', category: 'express' as Category, meal_type: 'plat' as MealType,
    difficulty: 'facile' as Difficulty, servings: 1, is_favorite: false, is_public: true, calories: 310,
    ingredients: [{ name: 'Œufs', quantity: '3' }, { name: 'Jambon blanc', quantity: '2 tranches' }, { name: 'Emmental râpé', quantity: '40g' }, { name: 'Beurre', quantity: '10g' }, { name: 'Sel et poivre', quantity: 'PM' }],
    steps: ['Battre les œufs avec sel et poivre', 'Faire fondre le beurre dans une poêle', 'Verser les œufs, laisser prendre à feu moyen', 'Ajouter jambon et fromage sur une moitié', 'Plier et servir aussitôt'],
  },
  {
    title: 'Tarte aux pommes', emoji: '🥧', description: 'La tarte maison grand-mère',
    prep_time: '20', cook_time: '35', category: 'family' as Category, meal_type: 'dessert' as MealType,
    difficulty: 'facile' as Difficulty, servings: 8, is_favorite: true, is_public: true, calories: 290,
    ingredients: [{ name: 'Pâte brisée', quantity: '1 rouleau' }, { name: 'Pommes', quantity: '4' }, { name: 'Sucre', quantity: '60g' }, { name: 'Cannelle', quantity: '1 cc' }, { name: 'Beurre', quantity: '20g' }, { name: 'Confiture d\'abricot', quantity: '2 cs' }],
    steps: ['Préchauffer le four à 180°C', 'Étaler la pâte dans un moule à tarte', 'Peler et couper les pommes en fines lamelles', 'Disposer en rosace sur la pâte', 'Saupoudrer sucre et cannelle, parsemer de beurre', 'Cuire 35 min jusqu\'à dorure', 'Glacer avec confiture chauffée'],
  },
  {
    title: 'Saumon teriyaki', emoji: '🐟', description: 'Une recette japonaise facile et savoureuse',
    prep_time: '10', cook_time: '15', category: 'healthy' as Category, meal_type: 'plat' as MealType,
    difficulty: 'facile' as Difficulty, servings: 2, is_favorite: false, is_public: true, calories: 390,
    ingredients: [{ name: 'Pavés de saumon', quantity: '2 (300g)' }, { name: 'Sauce soja', quantity: '3 cs' }, { name: 'Miel', quantity: '2 cs' }, { name: 'Gingembre râpé', quantity: '1 cc' }, { name: 'Ail', quantity: '1 gousse' }, { name: 'Graines de sésame', quantity: '1 cs' }],
    steps: ['Mélanger sauce soja, miel, gingembre et ail', 'Mariner le saumon 10 min', 'Cuire à la poêle 4 min côté peau', 'Retourner, verser la marinade', 'Laisser caraméliser 3-4 min', 'Parsemer de sésame et servir avec du riz'],
  },
  {
    title: 'Smoothie bowl mangue-banane', emoji: '🥭', description: 'Un petit-déjeuner vitaminé',
    prep_time: '10', cook_time: '0', category: 'vegan' as Category, meal_type: 'entree' as MealType,
    difficulty: 'facile' as Difficulty, servings: 1, is_favorite: false, is_public: true, calories: 340,
    ingredients: [{ name: 'Mangue congelée', quantity: '150g' }, { name: 'Banane congelée', quantity: '1' }, { name: 'Lait de coco', quantity: '50ml' }, { name: 'Granola', quantity: '40g' }, { name: 'Fruits frais', quantity: 'au choix' }, { name: 'Graines de chia', quantity: '1 cs' }],
    steps: ['Mixer mangue, banane et lait de coco jusqu\'à consistance épaisse', 'Verser dans un bol', 'Garnir de granola, fruits frais et graines de chia', 'Servir immédiatement'],
  },
]

function parseQty(q: string): { value: number; unit: string } | null {
  if (!q) return null
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!m) return null
  return { value: parseFloat(m[1].replace(',', '.')), unit: m[2].trim().toLowerCase() }
}

function mergeQuantities(quantities: string[]): string {
  if (quantities.length === 0) return ''
  if (quantities.length === 1) return quantities[0]
  const parsed = quantities.map(parseQty)
  if (!parsed.every(p => p !== null)) return quantities.join(' + ')
  const units = new Set(parsed.map(p => p!.unit))
  if (units.size === 1) {
    const total = parsed.reduce((acc, p) => acc + p!.value, 0)
    const unit = parsed[0]!.unit
    return unit ? `${total % 1 === 0 ? total : total.toFixed(1)}${unit}` : String(total)
  }
  return quantities.join(' + ')
}

// ─── BANDEAU ALLERGIE ─────────────────────────────────────────────────────────
function AllergyBanner({ alerts, onDismiss }: { alerts: AllergyAlert[]; onDismiss: () => void }) {
  if (alerts.length === 0) return null
  return (
    <div style={{ background: 'rgba(220,60,60,0.08)', border: '1.5px solid rgba(220,60,60,0.25)', borderRadius: 12, padding: '12px 16px', margin: '12px 20px 0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#C04040' }}>
          Alerte allergie dans ton planning
        </p>
        {alerts.map((a, i) => (
          <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#8A2020' }}>
            • <strong>{a.personName}</strong> est allergique à <strong>{a.allergen}</strong> — présent dans <strong>{a.recipeTitle}</strong> ({a.day}, {a.slot})
          </p>
        ))}
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#C04040', opacity: 0.7 }}>
          Pense à remplacer ces recettes dans le planning.
        </p>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C04040', fontSize: 16, flexShrink: 0, opacity: 0.6 }}>×</button>
    </div>
  )
}

// ─── CARTE RECETTE ────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onDragStart, onSelect, isSelected, onEdit, onDelete, hasAllergyWarning }: {
  recipe: Recipe; onDragStart: () => void; onSelect: () => void
  isSelected: boolean; onEdit: () => void; onDelete: () => void
  hasAllergyWarning?: boolean
}) {
  const mc = MEAL_TYPE_COLORS[recipe.meal_type] || MEAL_TYPE_COLORS.plat
  const cc = CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS.express
  const totalTime = parseInt(recipe.prep_time || '0') + parseInt(recipe.cook_time || '0')

  return (
    <div draggable onDragStart={onDragStart} onClick={onSelect}
      style={{ background: isSelected ? mc.bg : C.blanc, border: `1.5px solid ${hasAllergyWarning ? 'rgba(220,60,60,0.4)' : isSelected ? mc.border : C.grisClair}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'grab', transition: 'all 0.15s', boxShadow: hasAllergyWarning ? '0 2px 8px rgba(220,60,60,0.15)' : isSelected ? `0 2px 12px ${mc.border}33` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{recipe.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.noir, fontFamily: "'Cormorant Garamond',serif" }}>{recipe.title}</p>
            {hasAllergyWarning && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 5, background: 'rgba(220,60,60,0.1)', color: '#C04040', border: '1px solid rgba(220,60,60,0.2)', flexShrink: 0 }}>⚠️ Allergie</span>}
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>{mc.label}</span>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: cc.bg, color: cc.text }}>{cc.label}</span>
            <span style={{ fontSize: 9, color: C.gris }}>⏱ {totalTime}min · {recipe.servings} pers.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.gris, padding: '2px 4px' }}>✏️</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#E8A0A0', padding: '2px 4px' }}>🗑️</button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL DÉTAIL ─────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, onClose, onAddToPlan, allergyWarnings }: {
  recipe: Recipe; onClose: () => void; onAddToPlan: (day: string, slot: PlanSlot) => void
  allergyWarnings?: AllergyAlert[]
}) {
  const mc = MEAL_TYPE_COLORS[recipe.meal_type] || MEAL_TYPE_COLORS.plat
  const [showAddPlan, setShowAddPlan] = useState(false)
  const warnings = allergyWarnings?.filter(a => a.recipeTitle === recipe.title) || []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, padding: '24px 20px 40px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />

        {warnings.length > 0 && (
          <div style={{ background: 'rgba(220,60,60,0.08)', border: '1.5px solid rgba(220,60,60,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            {warnings.map((w, i) => (
              <p key={i} style={{ margin: 0, fontSize: 12, color: '#C04040' }}>
                ⚠️ <strong>{w.personName}</strong> est allergique à <strong>{w.allergen}</strong> présent dans cette recette
              </p>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 48 }}>{recipe.emoji}</div>
            <h2 style={{ margin: '8px 0 4px', fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: C.noir }}>{recipe.title}</h2>
            {recipe.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: C.gris }}>{recipe.description}</p>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>{mc.label}</span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: CATEGORY_COLORS[recipe.category]?.bg, color: CATEGORY_COLORS[recipe.category]?.text }}>{CATEGORY_COLORS[recipe.category]?.label}</span>
              <span style={{ fontSize: 10, color: C.gris }}>⏱ Prépa {recipe.prep_time}min{parseInt(recipe.cook_time) > 0 ? ` · Cuisson ${recipe.cook_time}min` : ''}</span>
              <span style={{ fontSize: 10, color: C.gris }}>👤 {recipe.servings} pers.</span>
              {recipe.calories && <span style={{ fontSize: 10, color: C.gris }}>🔥 {recipe.calories} kcal</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gris, marginLeft: 10 }}>×</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.noir, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5 }}>Ingrédients</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: C.cream, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: C.noir }}>{ing.name}</span>
                <span style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>{ing.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.noir, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5 }}>Préparation</h3>
          {recipe.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: mc.bg, border: `1px solid ${mc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: mc.text, flexShrink: 0 }}>{i+1}</span>
              <p style={{ margin: 0, fontSize: 13, color: C.noir, lineHeight: 1.5 }}>{step}</p>
            </div>
          ))}
        </div>

        {!showAddPlan ? (
          <button onClick={() => setShowAddPlan(true)} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: C.rose, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + Ajouter au planning
          </button>
        ) : (
          <div style={{ background: C.cream, borderRadius: 14, padding: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: C.gris, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Choisir le créneau</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DAYS.map(day => (
                <div key={day}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.noir, margin: '0 0 4px' }}>{day}</p>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {PLAN_SLOTS.map(slot => (
                      <button key={slot.key} onClick={() => { onAddToPlan(day, slot.key); setShowAddPlan(false); onClose() }}
                        style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 9, cursor: 'pointer', color: C.gris }}>
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAddPlan(false)} style={{ width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 12, cursor: 'pointer', color: C.gris }}>Annuler</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MODAL AJOUT / MODIFICATION ───────────────────────────────────────────────
function RecipeModal({ initial, onSave, onClose }: {
  initial?: Recipe; onSave: (r: Partial<Recipe>) => void; onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [emoji, setEmoji] = useState(initial?.emoji || '🍝')
  const [description, setDescription] = useState(initial?.description || '')
  const [prepTime, setPrepTime] = useState(initial?.prep_time || '15')
  const [cookTime, setCookTime] = useState(initial?.cook_time || '0')
  const [mealType, setMealType] = useState<MealType>(initial?.meal_type || 'plat')
  const [category, setCategory] = useState<Category>(initial?.category || 'express')
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty || 'facile')
  const [servings, setServings] = useState(initial?.servings || 4)
  const [calories, setCalories] = useState(initial?.calories || 0)
  const [ingredientsText, setIngredientsText] = useState(
    initial?.ingredients?.map(i => `${i.name}: ${i.quantity}`).join('\n') || ''
  )
  const [stepsText, setStepsText] = useState(initial?.steps?.join('\n') || '')
  const [showEmoji, setShowEmoji] = useState(false)

  const handleSave = () => {
    if (!title.trim() || !ingredientsText.trim()) return
    const ingredients: Ingredient[] = ingredientsText.split('\n').map(l => {
      const parts = l.split(':')
      return { name: parts[0]?.trim() || l.trim(), quantity: parts[1]?.trim() || '' }
    }).filter(i => i.name)
    const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean)
    onSave({
      title, emoji, description, prep_time: prepTime, cook_time: cookTime,
      meal_type: mealType, category, difficulty, servings,
      calories: calories || undefined, ingredients,
      steps: steps.length > 0 ? steps : ['Préparer selon votre goût'],
      is_favorite: initial?.is_favorite || false, is_public: false
    })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, padding: '20px 20px 40px', maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir }}>{initial ? 'Modifier la recette' : 'Nouvelle recette'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gris }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setShowEmoji(!showEmoji)} style={{ width: 52, height: 52, borderRadius: 14, border: `2px solid ${showEmoji ? C.rose : C.grisClair}`, background: C.cream, fontSize: 26, cursor: 'pointer', flexShrink: 0 }}>{emoji}</button>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nom de la recette..." autoFocus
            style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '0 14px', fontSize: 15, outline: 'none', color: C.noir, background: C.cream }} />
        </div>
        {showEmoji && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, padding: 10, background: C.cream, borderRadius: 12 }}>
            {EMOJIS.map(e => <button key={e} onClick={() => { setEmoji(e); setShowEmoji(false) }} style={{ fontSize: 22, width: 38, height: 38, borderRadius: 10, border: 'none', background: emoji === e ? 'rgba(196,149,106,0.2)' : 'transparent', cursor: 'pointer' }}>{e}</button>)}
          </div>
        )}

        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description courte (optionnel)..."
          style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 14px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, marginBottom: 14, boxSizing: 'border-box' as const }} />

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Type</p>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
          {(Object.keys(MEAL_TYPE_COLORS) as MealType[]).map(t => (
            <button key={t} onClick={() => setMealType(t)} style={{ padding: '6px 10px', borderRadius: 8, border: `2px solid ${mealType === t ? MEAL_TYPE_COLORS[t].border : C.grisClair}`, background: mealType === t ? MEAL_TYPE_COLORS[t].bg : 'white', fontSize: 11, fontWeight: mealType === t ? 700 : 400, color: mealType === t ? MEAL_TYPE_COLORS[t].text : C.gris, cursor: 'pointer' }}>
              {MEAL_TYPE_COLORS[t].label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Catégorie</p>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
          {(Object.keys(CATEGORY_COLORS) as Category[]).map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{ padding: '6px 10px', borderRadius: 8, border: `2px solid ${category === c ? '#aaa' : C.grisClair}`, background: category === c ? CATEGORY_COLORS[c].bg : 'white', fontSize: 11, fontWeight: category === c ? 700 : 400, color: category === c ? CATEGORY_COLORS[c].text : C.gris, cursor: 'pointer' }}>
              {CATEGORY_COLORS[c].label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Difficulté</p>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {(['facile', 'moyen', 'difficile'] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `2px solid ${difficulty === d ? C.rose : C.grisClair}`, background: difficulty === d ? 'rgba(196,149,106,0.1)' : 'white', fontSize: 12, fontWeight: difficulty === d ? 700 : 400, color: difficulty === d ? C.rose : C.gris, cursor: 'pointer', textTransform: 'capitalize' }}>
              {d}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Prépa (min)', value: prepTime, set: setPrepTime, type: 'text' },
            { label: 'Cuisson (min)', value: cookTime, set: setCookTime, type: 'text' },
            { label: 'Personnes', value: String(servings), set: (v: string) => setServings(+v), type: 'number' },
            { label: 'Calories', value: String(calories || ''), set: (v: string) => setCalories(+v), type: 'number' },
          ].map(({ label, value, set, type }) => (
            <div key={label}>
              <label style={{ fontSize: 10, color: '#aaa', display: 'block', marginBottom: 3 }}>{label}</label>
              <input type={type} value={value} onChange={e => set(e.target.value)}
                style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 8, padding: '7px 8px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Ingrédients <span style={{ fontWeight: 400, textTransform: 'none' }}>(un par ligne : Nom: Quantité)</span></p>
        <textarea value={ingredientsText} onChange={e => setIngredientsText(e.target.value)} placeholder={"Pomme de terre: 500g\nBeurre: 50g\nNoix de muscade: 1 pincée"} rows={5}
          style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, resize: 'none', boxSizing: 'border-box' as const, marginBottom: 14 }} />

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Préparation <span style={{ fontWeight: 400, textTransform: 'none' }}>(une étape par ligne)</span></p>
        <textarea value={stepsText} onChange={e => setStepsText(e.target.value)} placeholder={"Préchauffer le four à 180°C\nCouper les légumes\nEnfourner 30 min"} rows={4}
          style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, resize: 'none', boxSizing: 'border-box' as const, marginBottom: 16 }} />

        <button onClick={handleSave} disabled={!title.trim() || !ingredientsText.trim()}
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: title.trim() && ingredientsText.trim() ? C.rose : C.grisClair, color: title.trim() && ingredientsText.trim() ? 'white' : '#aaa', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {initial ? '✓ Enregistrer les modifications' : '+ Créer la recette'}
        </button>
      </div>
    </div>
  )
}

// ─── PANNEAU COURSES ──────────────────────────────────────────────────────────
function ShoppingPanel({ items, onToggle, onClose, onAddCustom, onDelete }: {
  items: ShoppingItem[]; onToggle: (id: string, field: 'checked' | 'in_stock') => void
  onClose: () => void; onAddCustom: (name: string, quantity: string) => void; onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')

  const pending = items.filter(i => !i.checked && !i.in_stock)
  const inStock = items.filter(i => i.in_stock)
  const bought = items.filter(i => i.checked)

  const renderItem = (item: ShoppingItem, dimmed = false) => (
    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, marginBottom: 4, background: dimmed ? 'rgba(144,200,168,0.08)' : item.is_custom ? 'rgba(123,111,160,0.06)' : C.cream, opacity: dimmed ? 0.7 : 1 }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, color: C.noir, fontWeight: 500, textDecoration: dimmed ? 'line-through' : 'none' }}>{item.ingredient}</span>
        {item.quantity && <span style={{ fontSize: 11, color: C.gris, marginLeft: 6 }}>— {item.quantity}{item.unit ? ' ' + item.unit : ''}</span>}
        {item.recipe_title && <p style={{ margin: '1px 0 0', fontSize: 10, color: C.gris, opacity: 0.6 }}>{item.is_custom ? '✏️ Manuel' : item.recipe_title}</p>}
      </div>
      {dimmed ? (
        <button onClick={() => onToggle(item.id, item.in_stock ? 'in_stock' : 'checked')} style={{ fontSize: 10, color: C.gris, background: 'none', border: 'none', cursor: 'pointer' }}>↩</button>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onToggle(item.id, 'in_stock')} style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${item.in_stock ? '#90C8A8' : C.grisClair}`, background: item.in_stock ? '#90C8A8' : 'white', fontSize: 10, color: item.in_stock ? 'white' : C.gris, cursor: 'pointer' }}>✓ Stock</button>
          <button onClick={() => onToggle(item.id, 'checked')} style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${item.checked ? C.rose : C.grisClair}`, background: item.checked ? C.rose : 'white', fontSize: 10, color: item.checked ? 'white' : C.gris, cursor: 'pointer' }}>✓ Acheté</button>
          {item.is_custom && <button onClick={() => onDelete(item.id)} style={{ fontSize: 14, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, padding: '20px 20px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.noir }}>🛒 Liste de courses</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gris }}>×</button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: C.gris }}>{pending.length} à acheter · {inStock.length} en stock · {bought.length} achetés</p>

        {!showForm ? (
          <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: `1.5px dashed ${C.violet}`, background: 'rgba(123,111,160,0.06)', color: C.violet, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16, width: '100%', justifyContent: 'center' }}>
            + Ajouter un article hors recette
          </button>
        ) : (
          <div style={{ background: 'rgba(123,111,160,0.06)', border: `1.5px solid rgba(123,111,160,0.2)`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Article..." autoFocus onKeyDown={e => e.key === 'Enter' && name.trim() && (onAddCustom(name, qty), setName(''), setQty(''), setShowForm(false))}
                style={{ flex: 2, border: `1.5px solid ${C.grisClair}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: C.noir, background: C.blanc }} />
              <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Qté"
                style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: C.noir, background: C.blanc }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { if (name.trim()) { onAddCustom(name, qty); setName(''); setQty(''); setShowForm(false) } }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: C.violet, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Ajouter</button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 13, cursor: 'pointer', color: C.gris }}>Annuler</button>
            </div>
          </div>
        )}

        {pending.length > 0 && <div style={{ marginBottom: 16 }}><p style={{ fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', margin: '0 0 8px' }}>À acheter ({pending.length})</p>{pending.map(i => renderItem(i))}</div>}
        {inStock.length > 0 && <div style={{ marginBottom: 16 }}><p style={{ fontSize: 11, fontWeight: 700, color: '#2A6A48', textTransform: 'uppercase', margin: '0 0 8px' }}>En stock ({inStock.length})</p>{inStock.map(i => renderItem(i, true))}</div>}
        {bought.length > 0 && <div style={{ marginBottom: 16 }}><p style={{ fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', margin: '0 0 8px' }}>Achetés ({bought.length})</p>{bought.map(i => renderItem(i, true))}</div>}
        {items.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0' }}><p style={{ fontSize: 32 }}>🛒</p><p style={{ color: C.gris, fontSize: 14 }}>Planifie des recettes pour générer ta liste</p></div>}
      </div>
    </div>
  )
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
export default function RecipesPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [mealSlots, setMealSlots] = useState<MealSlot[]>([])
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [allergyAlerts, setAllergyAlerts] = useState<AllergyAlert[]>([])
  const [showAllergyBanner, setShowAllergyBanner] = useState(true)
  const [filterMealType, setFilterMealType] = useState<MealType | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>(undefined)
  const [showModal, setShowModal] = useState(false)
  const [showShopping, setShowShopping] = useState(false)
  const [draggedRecipe, setDraggedRecipe] = useState<Recipe | null>(null)
  const [activeView, setActiveView] = useState<'library' | 'plan'>('library')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user && !authLoading) loadData() }, [user, authLoading])

  const computeAllergyAlerts = (slots: MealSlot[], familyData: any[]) => {
    const alerts: AllergyAlert[] = []
    const members = familyData
      .filter(m => m.data?.allergies && m.data.allergies.length > 0)
      .map(m => ({
        name: m.data?.firstName || m.data?.name || 'Membre',
        allergies: Array.isArray(m.data.allergies) ? m.data.allergies : [m.data.allergies]
      }))

    slots.forEach(slot => {
      const recipe = slot.recipe
      if (!recipe) return
      const ingredients = recipe.ingredients.map(i => i.name.toLowerCase())
      members.forEach(member => {
        member.allergies.forEach((allergen: string) => {
          const allergenLower = allergen.toLowerCase().trim()
          if (ingredients.some((ing: string) => ing.includes(allergenLower))) {
            alerts.push({
              personName: member.name,
              allergen,
              recipeTitle: recipe.title,
              day: slot.day_of_week,
              slot: PLAN_SLOTS.find(s => s.key === slot.meal_type)?.label || slot.meal_type
            })
          }
        })
      })
    })
    return alerts
  }

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [recipesRes, slotsRes, shoppingRes, familyRes] = await Promise.all([
        supabase.from('recipes').select('*').or(`user_id.eq.${user.id},is_public.eq.true`).order('created_at', { ascending: false }),
        supabase.from('meal_plan').select('*, recipes(*)').eq('user_id', user.id),
        supabase.from('shopping_list').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('family_data').select('*').eq('user_id', user.id).eq('is_active', true),
      ])

      let loadedRecipes = (recipesRes.data || []).map(normalizeRecipe)

      if (loadedRecipes.length === 0) {
        const toInsert = DEFAULT_RECIPES.map(r => ({ ...r, user_id: user.id }))
        const { data: inserted } = await supabase.from('recipes').insert(toInsert).select()
        if (inserted) loadedRecipes = inserted.map(normalizeRecipe)
      }

      setRecipes(loadedRecipes)

      const slots = (slotsRes.data || []).map(s => ({
        ...s,
        recipe: s.recipes ? normalizeRecipe(s.recipes) : loadedRecipes.find(r => r.id === s.recipe_id)
      })) as MealSlot[]
      setMealSlots(slots)

      setShoppingItems((shoppingRes.data || []).map(s => ({
        ...s, is_custom: !s.recipe_id, recipe_title: ''
      })) as ShoppingItem[])

      // Calcul des alertes allergie
      const family = familyRes.data || []
      const alerts = computeAllergyAlerts(slots, family)
      setAllergyAlerts(alerts)
      setShowAllergyBanner(alerts.length > 0)

    } catch (e) {
      console.error('Erreur chargement:', e)
    } finally {
      setLoading(false)
    }
  }

  const normalizeRecipe = (r: any): Recipe => ({
    id: r.id, user_id: r.user_id, title: r.title || '', emoji: r.emoji || '🍽️',
    description: r.description || '', prep_time: String(r.prep_time || '0'), cook_time: String(r.cook_time || '0'),
    category: r.category || 'express', meal_type: r.meal_type || 'plat', difficulty: r.difficulty || 'facile',
    servings: r.servings || 4, ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    steps: Array.isArray(r.steps) ? r.steps : [], is_favorite: r.is_favorite || false,
    is_public: r.is_public || false, calories: r.calories,
  })

  const saveRecipe = async (data: Partial<Recipe>) => {
    if (!user) return
    if (editingRecipe) {
      const { data: updated } = await supabase.from('recipes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingRecipe.id).select().single()
      if (updated) setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? normalizeRecipe(updated) : r))
    } else {
      const { data: inserted } = await supabase.from('recipes').insert({ ...data, user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single()
      if (inserted) setRecipes(prev => [normalizeRecipe(inserted), ...prev])
    }
    setEditingRecipe(undefined)
  }

  const deleteRecipe = async (id: string) => {
    if (!confirm('Supprimer cette recette ?')) return
    await supabase.from('meal_plan').delete().eq('recipe_id', id).eq('user_id', user?.id)
    await supabase.from('recipes').delete().eq('id', id)
    setRecipes(prev => prev.filter(r => r.id !== id))
    setMealSlots(prev => prev.filter(s => s.recipe_id !== id))
  }

  const addToPlan = async (recipeId: string, day: string, slot: PlanSlot) => {
    if (!user) return
    const recipe = recipes.find(r => r.id === recipeId)
    const { data } = await supabase.from('meal_plan').upsert({
      user_id: user.id, recipe_id: recipeId, day_of_week: day, meal_type: slot,
      updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day_of_week,meal_type' }).select().single()
    if (data) {
      const newSlots = [...mealSlots.filter(s => !(s.day_of_week === day && s.meal_type === slot)), { ...data, recipe }] as MealSlot[]
      setMealSlots(newSlots)
      // Recalculer les alertes
      const { data: familyData } = await supabase.from('family_data').select('*').eq('user_id', user.id).eq('is_active', true)
      const alerts = computeAllergyAlerts(newSlots, familyData || [])
      setAllergyAlerts(alerts)
      setShowAllergyBanner(alerts.length > 0)
    }
  }

  const removeFromPlan = async (slotId: string) => {
    await supabase.from('meal_plan').delete().eq('id', slotId)
    const newSlots = mealSlots.filter(s => s.id !== slotId)
    setMealSlots(newSlots)
    const { data: familyData } = await supabase.from('family_data').select('*').eq('user_id', user?.id).eq('is_active', true)
    const alerts = computeAllergyAlerts(newSlots, familyData || [])
    setAllergyAlerts(alerts)
    setShowAllergyBanner(alerts.length > 0)
  }

  const generateShopping = async () => {
    if (!user) return
    await supabase.from('shopping_list').delete().eq('user_id', user.id).not('recipe_id', 'is', null)
    const map = new Map<string, { quantities: string[]; recipeId: string; titles: string[] }>()
    mealSlots.forEach(slot => {
      const recipe = slot.recipe || recipes.find(r => r.id === slot.recipe_id)
      if (!recipe) return
      recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().trim()
        if (!map.has(key)) map.set(key, { quantities: [], recipeId: recipe.id, titles: [] })
        const e = map.get(key)!
        e.quantities.push(ing.quantity)
        if (!e.titles.includes(recipe.title)) e.titles.push(recipe.title)
      })
    })
    const newItems = Array.from(map.entries()).map(([key, val]) => {
      const originalName = recipes.flatMap(r => r.ingredients).find(i => i.name.toLowerCase().trim() === key)?.name || key
      return { user_id: user.id, ingredient: originalName, quantity: mergeQuantities(val.quantities), recipe_id: val.recipeId, checked: false, in_stock: false, to_buy: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    })
    let allItems: ShoppingItem[] = shoppingItems.filter(i => !i.recipe_id)
    if (newItems.length > 0) {
      const { data } = await supabase.from('shopping_list').insert(newItems).select()
      const enriched = (data || []).map(s => ({ ...s, recipe_title: map.get(s.ingredient?.toLowerCase().trim())?.titles.join(', ') || '' })) as ShoppingItem[]
      allItems = [...enriched, ...allItems]
    }
    setShoppingItems(allItems)
    setShowShopping(true)
  }

  const addCustomItem = async (name: string, quantity: string) => {
    if (!user) return
    const { data } = await supabase.from('shopping_list').insert({ user_id: user.id, ingredient: name, quantity, checked: false, in_stock: false, to_buy: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single()
    if (data) setShoppingItems(prev => [{ ...data, is_custom: true } as ShoppingItem, ...prev])
  }

  const toggleItem = async (id: string, field: 'checked' | 'in_stock') => {
    const item = shoppingItems.find(i => i.id === id)
    if (!item) return
    const update = field === 'in_stock' ? { in_stock: !item.in_stock, checked: false } : { checked: !item.checked, in_stock: false }
    await supabase.from('shopping_list').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id)
    setShoppingItems(prev => prev.map(i => i.id === id ? { ...i, ...update } : i))
  }

  const deleteItem = async (id: string) => {
    await supabase.from('shopping_list').delete().eq('id', id)
    setShoppingItems(prev => prev.filter(i => i.id !== id))
  }

  const filteredRecipes = recipes.filter(r => {
    if (filterMealType !== 'all' && r.meal_type !== filterMealType) return false
    if (filterCategory !== 'all' && r.category !== filterCategory) return false
    return true
  })

  // Recettes en conflit allergie (pour badge sur carte)
  const allergyRecipeTitles = new Set(allergyAlerts.map(a => a.recipeTitle))

  const getSlotsForDay = (day: string, slot: PlanSlot) => mealSlots.filter(s => s.day_of_week === day && s.meal_type === slot)
  const totalPlan = mealSlots.length
  const pendingItems = shoppingItems.filter(i => !i.checked && !i.in_stock).length

  if (authLoading || loading) {
    return <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: C.gris }}>Chargement...</p></div>
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.blanc, borderBottom: `1px solid ${C.grisClair}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ fontSize: 12, color: C.gris, textDecoration: 'none', padding: '4px 10px', borderRadius: 20, border: `1px solid ${C.grisClair}`, background: C.cream }}>← Accueil</Link>
          <h1 style={{ margin: 0, flex: 1, fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.noir }}>Recettes & Courses</h1>
          {allergyAlerts.length > 0 && (
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(220,60,60,0.1)', color: '#C04040', border: '1px solid rgba(220,60,60,0.2)', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setShowAllergyBanner(true)}>
              ⚠️ {allergyAlerts.length} alerte{allergyAlerts.length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={generateShopping} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: C.rose, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🛒 Courses {pendingItems > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{pendingItems}</span>}
          </button>
        </div>
      </div>

      {/* Bandeau allergie */}
      {showAllergyBanner && allergyAlerts.length > 0 && (
        <AllergyBanner alerts={allergyAlerts} onDismiss={() => setShowAllergyBanner(false)} />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.blanc, borderBottom: `1px solid ${C.grisClair}`, padding: '0 20px' }}>
        {[{ key: 'library', label: '📚 Recettes' }, { key: 'plan', label: `📅 Planning${totalPlan > 0 ? ` (${totalPlan})` : ''}` }].map(tab => (
          <button key={tab.key} onClick={() => setActiveView(tab.key as any)}
            style={{ flex: 1, padding: '12px 0', border: 'none', background: 'transparent', fontSize: 13, fontWeight: activeView === tab.key ? 700 : 400, color: activeView === tab.key ? C.rose : C.gris, borderBottom: `2px solid ${activeView === tab.key ? C.rose : 'transparent'}`, cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }} className="recipe-layout">
        <style>{`.recipe-layout { @media (max-width: 768px) { grid-template-columns: 1fr !important; } }`}</style>

        {/* ── BIBLIOTHÈQUE ── */}
        <div style={{ display: activeView === 'library' ? 'block' : 'none' }} className="recipe-library">
          <div style={{ background: C.blanc, borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(44,44,44,0.05)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: C.noir }}>Mes recettes ({recipes.length})</h2>
              <button onClick={() => { setEditingRecipe(undefined); setShowModal(true) }}
                style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: C.rose, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Nouvelle</button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: '#aaa', margin: '0 0 5px', textTransform: 'uppercase' }}>Type</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterMealType('all')} style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${filterMealType === 'all' ? C.rose : C.grisClair}`, background: filterMealType === 'all' ? 'rgba(196,149,106,0.1)' : 'white', fontSize: 10, fontWeight: filterMealType === 'all' ? 700 : 400, color: filterMealType === 'all' ? C.rose : C.gris, cursor: 'pointer' }}>Tous</button>
                {(Object.keys(MEAL_TYPE_COLORS) as MealType[]).map(t => (
                  <button key={t} onClick={() => setFilterMealType(t)} style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${filterMealType === t ? MEAL_TYPE_COLORS[t].border : C.grisClair}`, background: filterMealType === t ? MEAL_TYPE_COLORS[t].bg : 'white', fontSize: 10, fontWeight: filterMealType === t ? 700 : 400, color: filterMealType === t ? MEAL_TYPE_COLORS[t].text : C.gris, cursor: 'pointer' }}>{MEAL_TYPE_COLORS[t].label}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#aaa', margin: '0 0 5px', textTransform: 'uppercase' }}>Catégorie</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterCategory('all')} style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${filterCategory === 'all' ? C.rose : C.grisClair}`, background: filterCategory === 'all' ? 'rgba(196,149,106,0.1)' : 'white', fontSize: 10, fontWeight: filterCategory === 'all' ? 700 : 400, color: filterCategory === 'all' ? C.rose : C.gris, cursor: 'pointer' }}>Toutes</button>
                {(Object.keys(CATEGORY_COLORS) as Category[]).map(c => (
                  <button key={c} onClick={() => setFilterCategory(c)} style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${filterCategory === c ? '#aaa' : C.grisClair}`, background: filterCategory === c ? CATEGORY_COLORS[c].bg : 'white', fontSize: 10, fontWeight: filterCategory === c ? 700 : 400, color: filterCategory === c ? CATEGORY_COLORS[c].text : C.gris, cursor: 'pointer' }}>{CATEGORY_COLORS[c].label}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            {filteredRecipes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.gris }}><p style={{ fontSize: 32 }}>🍽️</p><p style={{ fontSize: 13 }}>Aucune recette trouvée</p></div>
            ) : filteredRecipes.map(r => (
              <RecipeCard key={r.id} recipe={r} isSelected={selectedRecipe?.id === r.id}
                hasAllergyWarning={allergyRecipeTitles.has(r.title)}
                onDragStart={() => setDraggedRecipe(r)}
                onSelect={() => setSelectedRecipe(selectedRecipe?.id === r.id ? null : r)}
                onEdit={() => { setEditingRecipe(r); setShowModal(true) }}
                onDelete={() => deleteRecipe(r.id)}
              />
            ))}
          </div>
        </div>

        {/* ── PLANNING ── */}
        <div style={{ display: activeView === 'plan' ? 'block' : 'none' }} className="recipe-plan">
          <div style={{ background: C.blanc, borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(44,44,44,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: C.noir }}>Planning de la semaine</h2>
              <button onClick={async () => { await supabase.from('meal_plan').delete().eq('user_id', user?.id); setMealSlots([]); setAllergyAlerts([]) }}
                style={{ fontSize: 11, color: C.gris, background: 'none', border: `1px solid ${C.grisClair}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>Vider</button>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 11, color: C.gris, opacity: 0.7 }}>Glisse une recette ou clique pour l'ajouter à un créneau</p>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 4, minWidth: 600 }}>
                <div />
                {DAYS.map((day, i) => (
                  <div key={day} style={{ textAlign: 'center', paddingBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.gris, textTransform: 'uppercase' }}>{DAYS_SHORT[i]}</p>
                  </div>
                ))}
                {PLAN_SLOTS.map(slot => (
                  <>
                    <div key={slot.key + '-label'} style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 6 }}>
                      <span style={{ fontSize: 9, color: C.gris, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{slot.label}</span>
                    </div>
                    {DAYS.map(day => {
                      const daySlots = getSlotsForDay(day, slot.key)
                      const s = daySlots[0]
                      const r = s ? (s.recipe || recipes.find(rec => rec.id === s.recipe_id)) : null
                      const mc = r ? (MEAL_TYPE_COLORS[r.meal_type] || MEAL_TYPE_COLORS.plat) : null
                      const hasAllergy = r ? allergyRecipeTitles.has(r.title) : false
                      return (
                        <div key={day + slot.key}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); if (draggedRecipe) { addToPlan(draggedRecipe.id, day, slot.key); setDraggedRecipe(null) } }}
                          style={{ minHeight: 52, border: `1.5px dashed ${hasAllergy ? 'rgba(220,60,60,0.4)' : C.grisClair}`, borderRadius: 8, padding: 3, background: r ? mc?.bg : 'transparent' }}>
                          {r && mc ? (
                            <div style={{ background: mc.bg, border: `1px solid ${hasAllergy ? 'rgba(220,60,60,0.5)' : mc.border}`, borderRadius: 5, padding: '3px 5px', position: 'relative', cursor: 'pointer' }} onClick={() => setSelectedRecipe(r)}>
                              <p style={{ margin: 0, fontSize: 8, fontWeight: 600, color: mc.text, paddingRight: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {hasAllergy ? '⚠️ ' : ''}{r.emoji} {r.title}
                              </p>
                              <button onClick={e => { e.stopPropagation(); removeFromPlan(s!.id) }}
                                style={{ position: 'absolute', top: 1, right: 2, background: 'none', border: 'none', fontSize: 9, cursor: 'pointer', color: mc.text }}>×</button>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: 8, color: '#ccc', textAlign: 'center', paddingTop: 10 }}>+</p>
                          )}
                        </div>
                      )
                    })}
                  </>
                ))}
              </div>
            </div>

            <button onClick={generateShopping} style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 12, border: 'none', background: totalPlan > 0 ? C.rose : C.grisClair, color: totalPlan > 0 ? 'white' : '#aaa', fontSize: 14, fontWeight: 700, cursor: totalPlan > 0 ? 'pointer' : 'default' }}>
              🛒 Générer la liste de courses {totalPlan > 0 ? `(${totalPlan} repas)` : ''}
            </button>
          </div>
        </div>
      </div>

      <style>{`@media (min-width: 769px) { .recipe-library, .recipe-plan { display: block !important; } }`}</style>

      {selectedRecipe && (
        <RecipeDetail recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)}
          allergyWarnings={allergyAlerts}
          onAddToPlan={(day, slot) => { addToPlan(selectedRecipe.id, day, slot); setSelectedRecipe(null) }} />
      )}
      {showModal && (
        <RecipeModal initial={editingRecipe} onSave={saveRecipe} onClose={() => { setShowModal(false); setEditingRecipe(undefined) }} />
      )}
      {showShopping && (
        <ShoppingPanel items={shoppingItems} onToggle={toggleItem} onClose={() => setShowShopping(false)} onAddCustom={addCustomItem} onDelete={deleteItem} />
      )}
    </div>
  )
}