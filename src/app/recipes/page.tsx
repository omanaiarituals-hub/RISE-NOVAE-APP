'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── TYPES ────────────────────────────────────────────────────────────────────
type MealCourse = 'entree' | 'plat' | 'dessert'
type RecipeType = 'normal' | 'allege' | 'proteine'
type RecipeCategory = 'express' | 'healthy' | 'family'

interface Ingredient {
  name: string
  quantity: string
}

interface Recipe {
  id: string
  title: string
  emoji: string
  prepTime: number
  cookTime: number
  course: MealCourse
  type: RecipeType
  category: RecipeCategory
  servings: number
  ingredients: Ingredient[]
  steps: string[]
  isFavorite: boolean
}

interface MealSlot {
  recipeId: string
  addedAt: string
}

interface DayPlan {
  day: string
  midi: MealSlot[]
  soir: MealSlot[]
}

interface ShoppingItem {
  id: string
  name: string
  quantity: string
  recipeTitle: string
  status: 'pending' | 'inStock' | 'bought'
  isCustom?: boolean
}

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  cream: '#FAF7F2',
  rose: '#C4956A',
  roseLight: 'rgba(196,149,106,0.1)',
  violet: '#7B6FA0',
  violetLight: 'rgba(123,111,160,0.1)',
  noir: '#2C2C2C',
  gris: '#6B6B6B',
  grisClair: '#E8E4DF',
  blanc: '#FFFFFF',
}

const COURSE_COLORS: Record<MealCourse, { bg: string; border: string; text: string; label: string }> = {
  entree:  { bg: 'rgba(144,200,168,0.15)', border: '#90C8A8', text: '#2A6A48', label: 'Entrée' },
  plat:    { bg: 'rgba(196,149,106,0.15)', border: '#C4956A', text: '#7A4A1A', label: 'Plat' },
  dessert: { bg: 'rgba(224,160,184,0.15)', border: '#E0A0B8', text: '#8A3050', label: 'Dessert' },
}

const TYPE_COLORS: Record<RecipeType, { bg: string; text: string; label: string }> = {
  normal:   { bg: '#E8E4DF', text: '#6B6B6B', label: 'Normal' },
  allege:   { bg: 'rgba(144,200,168,0.2)', text: '#2A6A48', label: 'Allégé' },
  proteine: { bg: 'rgba(160,190,220,0.2)', text: '#2C5F8A', label: 'Protéiné' },
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const EMOJIS_RECIPE = ['🥗','🍝','🥩','🐟','🍲','🥘','🫕','🥙','🌮','🥨','🍰','🎂','🍮','🥧','🍜','🍛','🍣','🥚','🥦','🥕']

function uid() { return Math.random().toString(36).slice(2) }

// ─── UTILITAIRE CUMUL QUANTITÉS ───────────────────────────────────────────────
function parseQuantity(q: string): { value: number; unit: string } | null {
  if (!q) return null
  const match = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!match) return null
  return { value: parseFloat(match[1].replace(',', '.')), unit: match[2].trim().toLowerCase() }
}

function mergeQuantities(quantities: string[]): string {
  if (quantities.length === 0) return ''
  if (quantities.length === 1) return quantities[0]
  const parsed = quantities.map(parseQuantity)
  const allParsed = parsed.every(p => p !== null)
  if (!allParsed) return quantities.join(' + ')
  const units = new Set(parsed.map(p => p!.unit))
  if (units.size === 1) {
    const total = parsed.reduce((acc, p) => acc + p!.value, 0)
    const unit = parsed[0]!.unit
    const totalStr = total % 1 === 0 ? total.toString() : total.toFixed(1)
    return unit ? `${totalStr}${unit}` : totalStr
  }
  return quantities.join(' + ')
}

const INIT_RECIPES: Recipe[] = [
  {
    id: '1', title: 'Salade César', emoji: '🥗', prepTime: 15, cookTime: 10,
    course: 'entree', type: 'allege', category: 'healthy', servings: 2,
    ingredients: [{ name: 'Laitue romaine', quantity: '1 tête' }, { name: 'Poulet grillé', quantity: '200g' }, { name: 'Parmesan', quantity: '50g' }, { name: 'Croûtons', quantity: '100g' }],
    steps: ['Laver et couper la laitue', 'Griller le poulet 10 min', 'Râper le parmesan', 'Assembler et assaisonner'],
    isFavorite: true,
  },
  {
    id: '2', title: 'Pâtes Carbonara', emoji: '🍝', prepTime: 10, cookTime: 15,
    course: 'plat', type: 'normal', category: 'express', servings: 4,
    ingredients: [{ name: 'Pâtes', quantity: '400g' }, { name: 'Lardons', quantity: '150g' }, { name: 'Œufs', quantity: '4' }, { name: 'Parmesan', quantity: '80g' }, { name: 'Poivre', quantity: 'PM' }],
    steps: ['Cuire les pâtes al dente', 'Faire revenir les lardons', 'Mélanger œufs et parmesan', 'Hors feu mélanger tout', 'Poivrer généreusement'],
    isFavorite: false,
  },
  {
    id: '3', title: 'Tiramisu', emoji: '🍮', prepTime: 30, cookTime: 0,
    course: 'dessert', type: 'normal', category: 'family', servings: 6,
    ingredients: [{ name: 'Mascarpone', quantity: '500g' }, { name: 'Œufs', quantity: '4' }, { name: 'Sucre', quantity: '100g' }, { name: 'Boudoirs', quantity: '200g' }, { name: 'Café fort', quantity: '200ml' }],
    steps: ['Séparer les blancs des jaunes', 'Battre jaunes + sucre', 'Incorporer le mascarpone', 'Monter les blancs en neige', 'Tremper boudoirs dans le café', 'Alterner couches et réfrigérer 4h'],
    isFavorite: true,
  },
]

const INIT_PLAN: DayPlan[] = DAYS.map(day => ({ day, midi: [], soir: [] }))

// ─── COMPOSANT CARTE RECETTE ──────────────────────────────────────────────────
function RecipeCard({ recipe, onDragStart, onSelect, isSelected }: {
  recipe: Recipe
  onDragStart: () => void
  onSelect: () => void
  isSelected: boolean
}) {
  const cc = COURSE_COLORS[recipe.course]
  const tc = TYPE_COLORS[recipe.type]
  const totalTime = recipe.prepTime + recipe.cookTime

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      style={{
        background: isSelected ? cc.bg : C.blanc,
        border: `1.5px solid ${isSelected ? cc.border : C.grisClair}`,
        borderRadius: 14, padding: '12px 14px', marginBottom: 8,
        cursor: 'grab', transition: 'all 0.15s',
        boxShadow: isSelected ? `0 2px 12px ${cc.border}33` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{recipe.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.noir, fontFamily: "'Cormorant Garamond',serif" }}>{recipe.title}</p>
          <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>{cc.label}</span>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: tc.bg, color: tc.text }}>{tc.label}</span>
            <span style={{ fontSize: 9, color: C.gris }}>⏱ {totalTime}min · {recipe.servings} pers.</span>
          </div>
        </div>
        <span style={{ fontSize: 14, color: recipe.isFavorite ? '#E0A0B8' : C.grisClair, flexShrink: 0 }}>♥</span>
      </div>
    </div>
  )
}

// ─── MODAL DÉTAIL RECETTE ─────────────────────────────────────────────────────
function RecipeDetail({ recipe, onClose, onAddToPlan }: {
  recipe: Recipe
  onClose: () => void
  onAddToPlan: (day: string, slot: 'midi' | 'soir') => void
}) {
  const cc = COURSE_COLORS[recipe.course]
  const [showAddPlan, setShowAddPlan] = useState(false)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, padding: '24px 20px 40px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 48 }}>{recipe.emoji}</div>
            <h2 style={{ margin: '8px 0 4px', fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: C.noir }}>{recipe.title}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}` }}>{cc.label}</span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: TYPE_COLORS[recipe.type].bg, color: TYPE_COLORS[recipe.type].text }}>{TYPE_COLORS[recipe.type].label}</span>
              <span style={{ fontSize: 10, color: C.gris, padding: '3px 0' }}>⏱ Prépa {recipe.prepTime}min{recipe.cookTime > 0 ? ` · Cuisson ${recipe.cookTime}min` : ''}</span>
              <span style={{ fontSize: 10, color: C.gris, padding: '3px 0' }}>👤 {recipe.servings} personnes</span>
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
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: cc.bg, border: `1px solid ${cc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: cc.text, flexShrink: 0 }}>{i+1}</span>
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
                <div key={day} style={{ display: 'flex', gap: 4 }}>
                  <span style={{ fontSize: 11, color: C.noir, width: 52, paddingTop: 6 }}>{day.slice(0,3)}</span>
                  <button onClick={() => { onAddToPlan(day, 'midi'); setShowAddPlan(false); onClose() }}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 10, cursor: 'pointer', color: C.gris }}>Midi</button>
                  <button onClick={() => { onAddToPlan(day, 'soir'); setShowAddPlan(false); onClose() }}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 10, cursor: 'pointer', color: C.gris }}>Soir</button>
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

// ─── MODAL AJOUT RECETTE ──────────────────────────────────────────────────────
function AddRecipeModal({ onSave, onClose }: { onSave: (r: Recipe) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🍝')
  const [prepTime, setPrepTime] = useState(15)
  const [cookTime, setCookTime] = useState(0)
  const [course, setCourse] = useState<MealCourse>('plat')
  const [type, setType] = useState<RecipeType>('normal')
  const [category, setCategory] = useState<RecipeCategory>('express')
  const [servings, setServings] = useState(4)
  const [ingredientsText, setIngredientsText] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)

  const handleSave = () => {
    if (!title.trim() || !ingredientsText.trim()) return
    const ingredients: Ingredient[] = ingredientsText.split('\n').map(l => {
      const parts = l.split(':')
      return { name: parts[0]?.trim() || l.trim(), quantity: parts[1]?.trim() || '' }
    }).filter(i => i.name)
    const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean)
    onSave({ id: uid(), title, emoji, prepTime, cookTime, course, type, category, servings, ingredients, steps: steps.length > 0 ? steps : ['Préparer selon votre goût'], isFavorite: false })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, padding: '20px 20px 40px', maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir }}>Nouvelle recette</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gris }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setShowEmoji(!showEmoji)} style={{ width: 52, height: 52, borderRadius: 14, border: `2px solid ${showEmoji ? C.rose : C.grisClair}`, background: C.cream, fontSize: 26, cursor: 'pointer', flexShrink: 0 }}>{emoji}</button>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nom de la recette..." autoFocus
            style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '0 14px', fontSize: 15, outline: 'none', color: C.noir, background: C.cream, fontFamily: "'DM Sans',sans-serif" }} />
        </div>
        {showEmoji && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, padding: 10, background: C.cream, borderRadius: 12 }}>
            {EMOJIS_RECIPE.map(e => <button key={e} onClick={() => { setEmoji(e); setShowEmoji(false) }} style={{ fontSize: 22, width: 38, height: 38, borderRadius: 10, border: 'none', background: emoji === e ? C.roseLight : 'transparent', cursor: 'pointer' }}>{e}</button>)}
          </div>
        )}

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Type de plat</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['entree', 'plat', 'dessert'] as MealCourse[]).map(c => (
            <button key={c} onClick={() => setCourse(c)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `2px solid ${course === c ? COURSE_COLORS[c].border : C.grisClair}`, background: course === c ? COURSE_COLORS[c].bg : 'white', fontSize: 12, fontWeight: course === c ? 700 : 400, color: course === c ? COURSE_COLORS[c].text : C.gris, cursor: 'pointer' }}>
              {COURSE_COLORS[c].label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Menu</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['normal', 'allege', 'proteine'] as RecipeType[]).map(t => (
            <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `2px solid ${type === t ? '#aaa' : C.grisClair}`, background: type === t ? TYPE_COLORS[t].bg : 'white', fontSize: 12, fontWeight: type === t ? 700 : 400, color: type === t ? TYPE_COLORS[t].text : C.gris, cursor: 'pointer' }}>
              {TYPE_COLORS[t].label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Prépa (min)</label>
            <input type="number" value={prepTime} onChange={e => setPrepTime(+e.target.value)} style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 10px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Cuisson (min)</label>
            <input type="number" value={cookTime} onChange={e => setCookTime(+e.target.value)} style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 10px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Personnes</label>
            <input type="number" value={servings} onChange={e => setServings(+e.target.value)} style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 10px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
          </div>
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Ingrédients <span style={{ fontWeight: 400, textTransform: 'none' }}>(un par ligne, format: Nom: Quantité)</span></p>
        <textarea value={ingredientsText} onChange={e => setIngredientsText(e.target.value)} placeholder={"Laitue romaine: 1 tête\nPoulet: 200g\nParmesan: 50g"} rows={4}
          style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, resize: 'none', boxSizing: 'border-box' as const, marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }} />

        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Préparation <span style={{ fontWeight: 400, textTransform: 'none' }}>(une étape par ligne)</span></p>
        <textarea value={stepsText} onChange={e => setStepsText(e.target.value)} placeholder={"Laver et couper la laitue\nGriller le poulet 10 min\nAssembler et assaisonner"} rows={4}
          style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, resize: 'none', boxSizing: 'border-box' as const, marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }} />

        <button onClick={handleSave} disabled={!title.trim() || !ingredientsText.trim()}
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: title.trim() && ingredientsText.trim() ? C.rose : C.grisClair, color: title.trim() && ingredientsText.trim() ? 'white' : '#aaa', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          + Créer la recette
        </button>
      </div>
    </div>
  )
}

// ─── PANNEAU COURSES ──────────────────────────────────────────────────────────
function ShoppingPanel({ items, onToggle, onClose, onAddCustom, onDeleteCustom }: {
  items: ShoppingItem[]
  onToggle: (id: string, status: ShoppingItem['status']) => void
  onClose: () => void
  onAddCustom: (name: string, quantity: string) => void
  onDeleteCustom: (id: string) => void
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customQty, setCustomQty] = useState('')

  const pending = items.filter(i => i.status === 'pending')
  const inStock = items.filter(i => i.status === 'inStock')
  const bought = items.filter(i => i.status === 'bought')

  const handleAddCustom = () => {
    if (!customName.trim()) return
    onAddCustom(customName.trim(), customQty.trim())
    setCustomName('')
    setCustomQty('')
    setShowAddForm(false)
  }

  const statusBtn = (item: ShoppingItem, status: ShoppingItem['status'], label: string, activeColor: string) => (
    <button onClick={() => onToggle(item.id, item.status === status ? 'pending' : status)}
      style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${item.status === status ? activeColor : C.grisClair}`, background: item.status === status ? activeColor : 'white', fontSize: 10, fontWeight: item.status === status ? 700 : 400, color: item.status === status ? 'white' : C.gris, cursor: 'pointer' }}>
      {label}
    </button>
  )

  const renderItem = (item: ShoppingItem, dimmed = false) => (
    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, marginBottom: 4, background: dimmed ? 'rgba(144,200,168,0.08)' : item.isCustom ? 'rgba(123,111,160,0.06)' : C.cream, border: `1px solid ${dimmed ? 'rgba(144,200,168,0.3)' : item.isCustom ? 'rgba(123,111,160,0.2)' : C.grisClair}`, opacity: dimmed ? 0.7 : 1 }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, color: C.noir, fontWeight: 500, textDecoration: dimmed ? 'line-through' : 'none' }}>{item.name}</span>
        {item.quantity && <span style={{ fontSize: 11, color: C.gris, marginLeft: 6 }}>— {item.quantity}</span>}
        <p style={{ margin: '1px 0 0', fontSize: 10, color: C.gris, opacity: 0.6 }}>{item.isCustom ? '✏️ Ajout manuel' : item.recipeTitle}</p>
      </div>
      {dimmed ? (
        <button onClick={() => onToggle(item.id, 'pending')} style={{ fontSize: 10, color: C.gris, background: 'none', border: 'none', cursor: 'pointer' }}>↩</button>
      ) : (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {statusBtn(item, 'inStock', '✓ Stock', '#90C8A8')}
          {statusBtn(item, 'bought', '✓ Acheté', C.rose)}
          {item.isCustom && (
            <button onClick={() => onDeleteCustom(item.id)} style={{ fontSize: 14, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 2 }}>×</button>
          )}
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

        {/* Bouton ajout manuel */}
        {!showAddForm ? (
          <button onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: `1.5px dashed ${C.violet}`, background: 'rgba(123,111,160,0.06)', color: C.violet, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16, width: '100%', justifyContent: 'center' }}>
            + Ajouter un article hors recette
          </button>
        ) : (
          <div style={{ background: 'rgba(123,111,160,0.06)', border: `1.5px solid rgba(123,111,160,0.2)`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: C.violet, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ajout manuel</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Article..." autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                style={{ flex: 2, border: `1.5px solid ${C.grisClair}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: C.noir, background: C.blanc }} />
              <input value={customQty} onChange={e => setCustomQty(e.target.value)} placeholder="Qté (ex: 500g)"
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: C.noir, background: C.blanc }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddCustom} disabled={!customName.trim()} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: customName.trim() ? C.violet : C.grisClair, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Ajouter</button>
              <button onClick={() => { setShowAddForm(false); setCustomName(''); setCustomQty('') }} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 13, cursor: 'pointer', color: C.gris }}>Annuler</button>
            </div>
          </div>
        )}

        {/* À acheter */}
        {pending.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>À acheter ({pending.length})</p>
            {pending.map(item => renderItem(item))}
          </div>
        )}

        {/* En stock */}
        {inStock.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#2A6A48', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>En stock ({inStock.length})</p>
            {inStock.map(item => renderItem(item, true))}
          </div>
        )}

        {/* Achetés */}
        {bought.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Achetés ({bought.length})</p>
            {bought.map(item => renderItem(item, true))}
          </div>
        )}

        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🛒</p>
            <p style={{ color: C.gris, fontSize: 14 }}>Planifie des recettes ou ajoute des articles manuellement</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>(INIT_RECIPES)
  const [mealPlan, setMealPlan] = useState<DayPlan[]>(INIT_PLAN)
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [filterCourse, setFilterCourse] = useState<MealCourse | 'all'>('all')
  const [filterType, setFilterType] = useState<RecipeType | 'all'>('all')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [showShopping, setShowShopping] = useState(false)
  const [draggedRecipe, setDraggedRecipe] = useState<Recipe | null>(null)
  const [activeView, setActiveView] = useState<'library' | 'plan'>('library')

  useEffect(() => {
    try {
      const r = localStorage.getItem('novae-recipes')
      const p = localStorage.getItem('novae-mealplan')
      const s = localStorage.getItem('novae-shopping')
      if (r) setRecipes(JSON.parse(r))
      if (p) setMealPlan(JSON.parse(p))
      if (s) setShoppingItems(JSON.parse(s))
    } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem('novae-recipes', JSON.stringify(recipes)) } catch {} }, [recipes])
  useEffect(() => { try { localStorage.setItem('novae-mealplan', JSON.stringify(mealPlan)) } catch {} }, [mealPlan])
  useEffect(() => { try { localStorage.setItem('novae-shopping', JSON.stringify(shoppingItems)) } catch {} }, [shoppingItems])

  const filteredRecipes = recipes.filter(r => {
    if (filterCourse !== 'all' && r.course !== filterCourse) return false
    if (filterType !== 'all' && r.type !== filterType) return false
    return true
  })

  const addToPlan = (recipeId: string, day: string, slot: 'midi' | 'soir') => {
    setMealPlan(prev => prev.map(d => d.day === day ? {
      ...d,
      [slot]: [...d[slot], { recipeId, addedAt: new Date().toISOString() }]
    } : d))
  }

  const removeFromPlan = (day: string, slot: 'midi' | 'soir', recipeId: string) => {
    setMealPlan(prev => prev.map(d => d.day === day ? {
      ...d,
      [slot]: d[slot].filter(s => s.recipeId !== recipeId)
    } : d))
  }

  const handleDrop = (e: React.DragEvent, day: string, slot: 'midi' | 'soir') => {
    e.preventDefault()
    if (draggedRecipe) {
      addToPlan(draggedRecipe.id, day, slot)
      setDraggedRecipe(null)
    }
  }

  // ─── GÉNÉRATION COURSES AVEC CUMUL ───────────────────────────────────────
  const generateShopping = () => {
    // Garder les articles custom existants
    const customItems = shoppingItems.filter(i => i.isCustom)

    // Construire map nom_normalisé → { quantities[], recipeTitle, status existant }
    type Accum = { quantities: string[]; recipeTitles: string[]; existingStatus?: ShoppingItem['status'] }
    const ingredientMap = new Map<string, Accum>()

    mealPlan.forEach(day => {
      const allSlots = [...day.midi, ...day.soir]
      allSlots.forEach(slot => {
        const recipe = recipes.find(r => r.id === slot.recipeId)
        if (!recipe) return
        recipe.ingredients.forEach(ing => {
          const key = ing.name.toLowerCase().trim()
          if (!ingredientMap.has(key)) {
            ingredientMap.set(key, { quantities: [], recipeTitles: [] })
          }
          const entry = ingredientMap.get(key)!
          entry.quantities.push(ing.quantity)
          if (!entry.recipeTitles.includes(recipe.title)) {
            entry.recipeTitles.push(recipe.title)
          }
        })
      })
    })

    // Récupérer statuts existants pour les articles non-custom
    const existingStatusMap = new Map<string, ShoppingItem['status']>()
    shoppingItems.filter(i => !i.isCustom).forEach(i => {
      existingStatusMap.set(i.name.toLowerCase().trim(), i.status)
    })

    const recipeItems: ShoppingItem[] = Array.from(ingredientMap.entries()).map(([key, val]) => ({
      id: uid(),
      name: val.recipeTitles.length > 0 ? recipes.flatMap(r => r.ingredients).find(i => i.name.toLowerCase().trim() === key)?.name || key : key,
      quantity: mergeQuantities(val.quantities),
      recipeTitle: val.recipeTitles.join(', '),
      status: existingStatusMap.get(key) || 'pending',
      isCustom: false,
    }))

    setShoppingItems([...recipeItems, ...customItems])
    setShowShopping(true)
  }

  const addCustomShoppingItem = (name: string, quantity: string) => {
    const newItem: ShoppingItem = {
      id: uid(), name, quantity, recipeTitle: '', status: 'pending', isCustom: true,
    }
    setShoppingItems(prev => [newItem, ...prev])
  }

  const deleteCustomShoppingItem = (id: string) => {
    setShoppingItems(prev => prev.filter(i => i.id !== id))
  }

  const toggleShoppingItem = (id: string, newStatus: ShoppingItem['status']) => {
    setShoppingItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
  }

  const getRecipeById = (id: string) => recipes.find(r => r.id === id)

  const totalPlanRecipes = mealPlan.reduce((acc, d) => acc + d.midi.length + d.soir.length, 0)
  const pendingItems = shoppingItems.filter(i => i.status === 'pending').length

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>

      <div style={{ background: C.blanc, borderBottom: `1px solid ${C.grisClair}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ fontSize: 12, color: C.gris, textDecoration: 'none', padding: '4px 10px', borderRadius: 20, border: `1px solid ${C.grisClair}`, background: C.cream }}>← Accueil</Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.noir }}>Recettes & Courses</h1>
          </div>
          <button onClick={generateShopping} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: C.rose, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🛒 Courses {pendingItems > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{pendingItems}</span>}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', background: C.blanc, borderBottom: `1px solid ${C.grisClair}`, padding: '0 20px' }} className="md:hidden">
        {[{ key: 'library', label: '📚 Recettes' }, { key: 'plan', label: `📅 Planning ${totalPlanRecipes > 0 ? `(${totalPlanRecipes})` : ''}` }].map(tab => (
          <button key={tab.key} onClick={() => setActiveView(tab.key as any)}
            style={{ flex: 1, padding: '12px 0', border: 'none', background: 'transparent', fontSize: 13, fontWeight: activeView === tab.key ? 700 : 400, color: activeView === tab.key ? C.rose : C.gris, borderBottom: `2px solid ${activeView === tab.key ? C.rose : 'transparent'}`, cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px', display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }} className="recipe-layout">
        <style>{`
          @media (max-width: 768px) {
            .recipe-layout { grid-template-columns: 1fr !important; }
            .recipe-library { display: ${activeView === 'library' ? 'block' : 'none'} !important; }
            .recipe-plan { display: ${activeView === 'plan' ? 'block' : 'none'} !important; }
          }
        `}</style>

        {/* ── BIBLIOTHÈQUE ── */}
        <div className="recipe-library">
          <div style={{ background: C.blanc, borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(44,44,44,0.05)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: C.noir }}>Mes recettes</h2>
              <button onClick={() => setShowAddRecipe(true)} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: C.rose, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Nouvelle</button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: '#aaa', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plat</p>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'entree', 'plat', 'dessert'] as const).map(c => (
                  <button key={c} onClick={() => setFilterCourse(c)}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: `1.5px solid ${filterCourse === c ? (c === 'all' ? C.rose : COURSE_COLORS[c]?.border || C.rose) : C.grisClair}`, background: filterCourse === c ? (c === 'all' ? C.roseLight : COURSE_COLORS[c]?.bg || C.roseLight) : 'white', fontSize: 10, fontWeight: filterCourse === c ? 700 : 400, color: filterCourse === c ? (c === 'all' ? C.rose : COURSE_COLORS[c]?.text || C.rose) : C.gris, cursor: 'pointer' }}>
                    {c === 'all' ? 'Tous' : COURSE_COLORS[c].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#aaa', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Menu</p>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'normal', 'allege', 'proteine'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: `1.5px solid ${filterType === t ? C.rose : C.grisClair}`, background: filterType === t ? C.roseLight : 'white', fontSize: 10, fontWeight: filterType === t ? 700 : 400, color: filterType === t ? C.rose : C.gris, cursor: 'pointer' }}>
                    {t === 'all' ? 'Tous' : TYPE_COLORS[t].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {filteredRecipes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.gris }}>
                <p style={{ fontSize: 32 }}>🍽️</p>
                <p style={{ fontSize: 13 }}>Aucune recette — crée la première !</p>
              </div>
            ) : filteredRecipes.map(r => (
              <RecipeCard key={r.id} recipe={r} isSelected={selectedRecipe?.id === r.id}
                onDragStart={() => setDraggedRecipe(r)}
                onSelect={() => setSelectedRecipe(selectedRecipe?.id === r.id ? null : r)}
              />
            ))}
          </div>
        </div>

        {/* ── PLANNING ── */}
        <div className="recipe-plan">
          <div style={{ background: C.blanc, borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(44,44,44,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: C.noir }}>Planning de la semaine</h2>
              <button onClick={() => setMealPlan(INIT_PLAN)} style={{ fontSize: 11, color: C.gris, background: 'none', border: `1px solid ${C.grisClair}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>Vider</button>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 11, color: C.gris, opacity: 0.7 }}>Glisse une recette ou clique dessus pour l'ajouter à un créneau</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {mealPlan.map((day, i) => (
                <div key={day.day}>
                  <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.gris, textTransform: 'uppercase' }}>{DAYS_SHORT[i]}</p>
                  </div>

                  <div onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, day.day, 'midi')}
                    style={{ minHeight: 80, border: `1.5px dashed ${C.grisClair}`, borderRadius: 10, padding: 4, marginBottom: 4, background: day.midi.length > 0 ? 'rgba(196,149,106,0.04)' : 'transparent' }}>
                    <p style={{ margin: '0 0 3px', fontSize: 8, color: C.gris, textAlign: 'center', opacity: 0.6 }}>Midi</p>
                    {day.midi.map(slot => {
                      const r = getRecipeById(slot.recipeId)
                      if (!r) return null
                      const cc = COURSE_COLORS[r.course]
                      return (
                        <div key={slot.recipeId + slot.addedAt} style={{ background: cc.bg, border: `1px solid ${cc.border}`, borderRadius: 6, padding: '3px 5px', marginBottom: 2, position: 'relative', cursor: 'pointer' }}
                          onClick={() => setSelectedRecipe(r)}>
                          <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: cc.text, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.emoji} {r.title}</p>
                          <button onClick={e => { e.stopPropagation(); removeFromPlan(day.day, 'midi', slot.recipeId) }}
                            style={{ position: 'absolute', top: 1, right: 2, background: 'none', border: 'none', fontSize: 10, cursor: 'pointer', color: cc.text, lineHeight: 1 }}>×</button>
                        </div>
                      )
                    })}
                    {day.midi.length === 0 && <p style={{ margin: 0, fontSize: 8, color: '#ccc', textAlign: 'center', paddingTop: 8 }}>+</p>}
                  </div>

                  <div onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, day.day, 'soir')}
                    style={{ minHeight: 80, border: `1.5px dashed ${C.grisClair}`, borderRadius: 10, padding: 4, background: day.soir.length > 0 ? 'rgba(123,111,160,0.04)' : 'transparent' }}>
                    <p style={{ margin: '0 0 3px', fontSize: 8, color: C.gris, textAlign: 'center', opacity: 0.6 }}>Soir</p>
                    {day.soir.map(slot => {
                      const r = getRecipeById(slot.recipeId)
                      if (!r) return null
                      const cc = COURSE_COLORS[r.course]
                      return (
                        <div key={slot.recipeId + slot.addedAt} style={{ background: cc.bg, border: `1px solid ${cc.border}`, borderRadius: 6, padding: '3px 5px', marginBottom: 2, position: 'relative', cursor: 'pointer' }}
                          onClick={() => setSelectedRecipe(r)}>
                          <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: cc.text, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.emoji} {r.title}</p>
                          <button onClick={e => { e.stopPropagation(); removeFromPlan(day.day, 'soir', slot.recipeId) }}
                            style={{ position: 'absolute', top: 1, right: 2, background: 'none', border: 'none', fontSize: 10, cursor: 'pointer', color: cc.text, lineHeight: 1 }}>×</button>
                        </div>
                      )
                    })}
                    {day.soir.length === 0 && <p style={{ margin: 0, fontSize: 8, color: '#ccc', textAlign: 'center', paddingTop: 8 }}>+</p>}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={generateShopping} style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 12, border: 'none', background: totalPlanRecipes > 0 ? C.rose : C.grisClair, color: totalPlanRecipes > 0 ? 'white' : '#aaa', fontSize: 14, fontWeight: 700, cursor: totalPlanRecipes > 0 ? 'pointer' : 'default' }}>
              🛒 Générer la liste de courses {totalPlanRecipes > 0 ? `(${totalPlanRecipes} recettes)` : ''}
            </button>
          </div>
        </div>
      </div>

      {selectedRecipe && (
        <RecipeDetail recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)}
          onAddToPlan={(day, slot) => { addToPlan(selectedRecipe.id, day, slot); setSelectedRecipe(null) }} />
      )}
      {showAddRecipe && <AddRecipeModal onSave={r => setRecipes(prev => [...prev, r])} onClose={() => setShowAddRecipe(false)} />}
      {showShopping && (
        <ShoppingPanel
          items={shoppingItems}
          onToggle={toggleShoppingItem}
          onClose={() => setShowShopping(false)}
          onAddCustom={addCustomShoppingItem}
          onDeleteCustom={deleteCustomShoppingItem}
        />
      )}
    </div>
  )
}