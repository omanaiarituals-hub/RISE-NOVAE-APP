'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp, Edit2, Gift, Camera, Smile } from 'lucide-react'
import { DemoBanner } from '@/components/DemoBanner'
import { logEvent } from '@/lib/events'


type MemberCategory = 'foyer' | 'famille' | 'proches' | 'professionnel'
type MemberRelation = 'conjoint' | 'enfant' | 'parent' | 'frere_soeur' | 'neveu_niece' | 'cousin' | 'grand_parent' | 'ami' | 'collegue' | 'autre'
type MemberGender = 'female' | 'male' | ''

interface FamilyMember {
  id: string
  firstName: string
  lastName: string
  relation: MemberRelation
  gender: MemberGender
  category: MemberCategory
  isHouseholdMember: boolean
  birthDate: string
  photo: string       // avatar emoji (fallback)
  photoUrl: string    // photo importée (data URL) — prioritaire si présente
  clothingSize: string
  shoeSize: string
  allergies: string
  healthNotes: string
  phone: string
  email: string
  isPrimaryContact: boolean
  dietaryRegime: string
  foodPreferences: string
  foodDislikes: string
  giftIdeas: string
  notes: string
  supabaseId?: string
  relation_to_user?: string
}

// ─── Couleurs : univers Famille = vert menthe, fond beige ───────────────────
const C = {
  beige: '#F8F1E5',
  cream: '#FBF6EE',
  rose: '#5E9A82',
  roseLight: 'rgba(185,215,203,0.28)',
  deep: '#4A7D67',
  noir: '#3D2618', gris: '#6B6B6B', grisClair: '#E8E4DF', blanc: '#FFFFFF',
}

const RELATIONS: Record<MemberRelation, string> = {
  conjoint: '💑 Conjoint(e)', enfant: '👶 Enfant', parent: '👨‍👩‍👧 Parent',
  frere_soeur: '👫 Frère/Sœur', neveu_niece: '🧒 Neveu/Nièce', cousin: '🧑 Cousin(e)',
  grand_parent: '👴 Grand-parent', ami: '🤝 Ami(e)', collegue: '💼 Collègue', autre: '⭐ Autre',
}

// Périmètre des repas pour l'IA (détection allergies/goûts) :
//  • défaut, aucune précision        → ['foyer']
//  • "repas amis"                    → ['amis']
//  • "repas collègues" / "autres"    → ['autres']
//  • "repas de famille"              → ['foyer','famille']
//  • "gros repas" / "invités"        → toutes les catégories
const CATEGORIES: Record<MemberCategory, { label: string; emoji: string; color: string; bg: string }> = {
  foyer:          { label: 'Mon foyer',      emoji: '🏡', color: '#5E9A82', bg: 'rgba(185,215,203,0.28)' },
  famille:        { label: 'Ma famille',      emoji: '👨‍👩‍👧‍👦', color: '#C77E52', bg: 'rgba(243,205,182,0.32)' },
  proches:        { label: 'Mes proches',     emoji: '🤝', color: '#8A6FB0', bg: 'rgba(212,196,226,0.32)' },
  professionnel:  { label: 'Mon réseau pro', emoji: '💼', color: '#8A6A45', bg: 'rgba(232,208,128,0.22)' },
}

const CATEGORY_KEYS: MemberCategory[] = ['foyer', 'famille', 'proches', 'professionnel']

const AVATARS = ['👩','👨','👧','👦','👶','🧑','👩‍🦱','👨‍🦱','👩‍🦰','👨‍🦰','🧒','👴','👵','🧔','👩‍🦳','👨‍🦳']

// Redimensionne une image importée en data URL (max 256px, JPEG) pour rester léger
function resizeImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas context')); return }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Affiche soit la photo importée, soit l'emoji
function Avatar({ photo, photoUrl, px, radius = 999 }: { photo: string; photoUrl?: string; px: number; radius?: number }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" style={{ width: px, height: px, borderRadius: radius, objectFit: 'cover', display: 'block' }} />
  }
  return <span style={{ fontSize: Math.round(px * 0.66), lineHeight: 1 }}>{photo}</span>
}

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function daysUntilBirthday(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

function formatBirthday(birthDate: string): string {
  return new Date(birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function fromSupabase(row: any): FamilyMember {
  const d = row.data || {}
  const relation: MemberRelation = d.relation || 'autre'
  // Migration douce des anciennes catégories → nouveau modèle (au chargement, sans toucher la BDD)
  let category = String(d.category || 'famille') as MemberCategory
  if (category === ('amis' as MemberCategory)) category = 'proches'
  if (category === ('collegues' as MemberCategory) || category === ('autres' as MemberCategory)) {
    category = relation === 'collegue' ? 'professionnel' : 'proches'
  }
  if (category === 'famille' && (relation === 'conjoint' || relation === 'enfant')) category = 'foyer'
  if (!CATEGORY_KEYS.includes(category)) category = relation === 'collegue' ? 'professionnel' : 'proches'

  return {
    id: row.id,
    supabaseId: row.id,
    firstName: d.firstName || d.name || '',
    lastName: d.lastName || '',
    relation,
    gender: d.gender === 'female' || d.gender === 'male' ? d.gender : '',
    category,
    isHouseholdMember: typeof d.isHouseholdMember === 'boolean' ? d.isHouseholdMember : category === 'foyer',
    birthDate: d.birthDate || d.birthday || '',
    photo: d.photo || '👤',
    photoUrl: d.photoUrl || '',
    clothingSize: d.clothingSize || '',
    shoeSize: d.shoeSize || '',
    allergies: Array.isArray(d.allergies) ? d.allergies.join(', ') : (d.allergies || d.healthNotes || ''),
    healthNotes: d.healthNotes || '',
    phone: d.phone || '',
    email: d.email || '',
    isPrimaryContact: row.is_primary_contact === true || d.isPrimaryContact === true,
    dietaryRegime: d.dietaryRegime || '',
    foodPreferences: Array.isArray(d.foodPreferences) ? d.foodPreferences.join(', ') : (d.foodPreferences || ''),
    foodDislikes: Array.isArray(d.foodDislikes) ? d.foodDislikes.join(', ') : (d.foodDislikes || ''),
    giftIdeas: d.giftIdeas || '',
    notes: d.notes || '',
    relation_to_user: row.relation_to_user || '',
  }
}

function toSupabase(m: FamilyMember, userId: string) {
  const allergiesList = m.allergies
    ? m.allergies.split(',').map(a => a.trim()).filter(Boolean)
    : []
  const foodPreferencesList = m.foodPreferences
    ? m.foodPreferences.split(',').map(value => value.trim()).filter(Boolean)
    : []
  const foodDislikesList = m.foodDislikes
    ? m.foodDislikes.split(',').map(value => value.trim()).filter(Boolean)
    : []
  return {
    user_id: userId,
    data_type: 'member',
    relation_to_user: RELATIONS[m.relation] || m.relation,
    is_primary_contact: m.isPrimaryContact,
    is_active: true,
    data: {
      firstName: m.firstName,
      lastName: m.lastName,
      name: m.firstName + (m.lastName ? ' ' + m.lastName : ''),
      relation: m.relation,
      gender: m.gender || null,
      category: m.category,
      isHouseholdMember: m.isHouseholdMember,
      birthDate: m.birthDate,
      birthday: m.birthDate,
      photo: m.photo,
      photoUrl: m.photoUrl,
      clothingSize: m.clothingSize,
      shoeSize: m.shoeSize,
      allergies: allergiesList,
      healthNotes: m.healthNotes,
      phone: m.phone,
      email: m.email,
      isPrimaryContact: m.isPrimaryContact,
      dietaryRegime: m.dietaryRegime,
      foodPreferences: foodPreferencesList,
      foodDislikes: foodDislikesList,
      giftIdeas: m.giftIdeas,
      notes: m.notes,
    },
    updated_at: new Date().toISOString(),
  }
}



type TransportMode = 'car' | 'walk' | 'bike' | 'public_transport' | 'other'
type PlaceKind = 'home' | 'work' | 'school' | 'daycare' | 'activity' | 'doctor' | 'pharmacy' | 'other'

interface RecurringPlace {
  id: string
  kind: PlaceKind
  label: string
  address: string
  approximate: boolean
  transportMode: TransportMode
  travelMinutes: number
  safetyMarginMinutes: number
  isReference: boolean
  icon?: string
  customType?: string
}

interface LocationConfig {
  supabaseId?: string
  defaultTransportMode: TransportMode
  defaultSafetyMarginMinutes: number
  places: RecurringPlace[]
}

const TRANSPORT_LABELS: Record<TransportMode, string> = {
  car: 'Voiture',
  walk: 'À pied',
  bike: 'Vélo',
  public_transport: 'Transports en commun',
  other: 'Autre',
}

const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  home: 'Domicile',
  work: 'Travail',
  school: 'École',
  daycare: 'Crèche / garde',
  activity: 'Activité',
  doctor: 'Médecin',
  pharmacy: 'Pharmacie',
  other: 'Autre lieu',
}

const PLACE_KIND_ICONS: Record<PlaceKind, string> = {
  home: '🏠',
  work: '💼',
  school: '🏫',
  daycare: '🧸',
  activity: '⚽',
  doctor: '🩺',
  pharmacy: '💊',
  other: '📍',
}

const PLACE_ICON_CHOICES = ['🏠', '💼', '🏫', '🧸', '⚽', '🩺', '💊', '📍', '🛒', '🏋️', '🚉', '✈️']

function locationConfigFromRow(row: any): LocationConfig {
  const d = row?.data || {}
  const rawPlaces = Array.isArray(d.places) ? d.places : []
  const explicitReferenceIndex = rawPlaces.findIndex((place: any) => place?.isReference === true)
  const fallbackHomeIndex = rawPlaces.findIndex((place: any) => place?.kind === 'home')
  const referenceIndex = explicitReferenceIndex >= 0 ? explicitReferenceIndex : fallbackHomeIndex
  const places = rawPlaces.map((place: any, index: number) => ({
    id: String(place?.id || `place-${index + 1}`),
    kind: (place?.kind || 'other') as PlaceKind,
    label: String(place?.label || ''),
    address: String(place?.address || ''),
    approximate: place?.approximate === true,
    transportMode: (place?.transportMode || d.defaultTransportMode || 'car') as TransportMode,
    travelMinutes: Math.max(0, Number(place?.travelMinutes) || 0),
    safetyMarginMinutes: Math.max(0, Number(place?.safetyMarginMinutes) || Number(d.defaultSafetyMarginMinutes) || 15),
    isReference: index === referenceIndex,
    icon: typeof place?.icon === 'string' && place.icon.trim()
      ? place.icon.trim()
      : PLACE_KIND_ICONS[((place?.kind || 'other') as PlaceKind)] || '📍',
    customType: typeof place?.customType === 'string' ? place.customType : '',
  }))

  return {
    supabaseId: row?.id,
    defaultTransportMode: (d.defaultTransportMode || 'car') as TransportMode,
    defaultSafetyMarginMinutes: Math.max(0, Number(d.defaultSafetyMarginMinutes) || 15),
    places,
  }
}

type CustodyMode = 'full_time' | 'alternate_weeks' | 'fixed_days' | 'custom'

interface CustodyConfig {
  supabaseId?: string
  mode: CustodyMode
  referenceDate: string
  fixedDays: number[]
  note: string
}

interface CustodyException {
  id: string
  supabaseId?: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  withChildren: boolean
  note: string
}

const CUSTODY_LABELS: Record<CustodyMode, string> = {
  full_time: 'Enfants avec moi à temps plein',
  alternate_weeks: 'Une semaine sur deux',
  fixed_days: 'Jours fixes chaque semaine',
  custom: 'Organisation personnalisée',
}

const WEEK_DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
]

function custodyConfigFromRow(row: any): CustodyConfig {
  const d = row?.data || {}
  return {
    supabaseId: row?.id,
    mode: (d.mode || 'alternate_weeks') as CustodyMode,
    referenceDate: d.referenceDate || '',
    fixedDays: Array.isArray(d.fixedDays) ? d.fixedDays.map(Number) : [],
    note: d.note || '',
  }
}

function custodyExceptionFromRow(row: any): CustodyException {
  const d = row?.data || {}
  return {
    id: row.id,
    supabaseId: row.id,
    startDate: d.startDate || '',
    startTime: d.startTime || '',
    endDate: d.endDate || d.startDate || '',
    endTime: d.endTime || '',
    withChildren: d.withChildren !== false,
    note: d.note || '',
  }
}

function CustodyPanel({
  config,
  exceptions,
  onSaveConfig,
  onAddException,
  onDeleteException,
}: {
  config: CustodyConfig
  exceptions: CustodyException[]
  onSaveConfig: (config: CustodyConfig) => Promise<void>
  onAddException: (exception: Omit<CustodyException, 'id'>) => Promise<void>
  onDeleteException: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(config)
  const [showException, setShowException] = useState(false)
  const [exceptionStart, setExceptionStart] = useState('')
  const [exceptionStartTime, setExceptionStartTime] = useState('')
  const [exceptionEnd, setExceptionEnd] = useState('')
  const [exceptionEndTime, setExceptionEndTime] = useState('')
  const [exceptionWithChildren, setExceptionWithChildren] = useState(true)
  const [exceptionNote, setExceptionNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(config), [config])

  const saveConfig = async () => {
    setSaving(true)
    try {
      await onSaveConfig(draft)
    } finally {
      setSaving(false)
    }
  }

  const addException = async () => {
    if (!exceptionStart) return
    await onAddException({
      startDate: exceptionStart,
      startTime: exceptionStartTime,
      endDate: exceptionEnd || exceptionStart,
      endTime: exceptionEndTime,
      withChildren: exceptionWithChildren,
      note: exceptionNote.trim(),
    })
    setExceptionStart('')
    setExceptionStartTime('')
    setExceptionEnd('')
    setExceptionEndTime('')
    setExceptionNote('')
    setExceptionWithChildren(true)
    setShowException(false)
  }

  return (
    <section style={{ marginBottom: 24, background: C.blanc, border: `1.5px solid ${C.grisClair}`, borderRadius: 18, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Organisation du foyer</p>
          <h2 style={{ margin: '3px 0 0', fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.noir }}>Présence des enfants</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.gris }}>Cette information aide Nova, les repas et le Planner. Elle ne bloque jamais tes journées.</p>
        </div>
        <span style={{ fontSize: 28 }}>🗓️</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
        {(Object.entries(CUSTODY_LABELS) as [CustodyMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setDraft(current => ({ ...current, mode }))}
            style={{ padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${draft.mode === mode ? C.rose : C.grisClair}`, background: draft.mode === mode ? C.roseLight : C.cream, color: draft.mode === mode ? C.deep : C.gris, fontSize: 12, fontWeight: draft.mode === mode ? 700 : 500, textAlign: 'left', cursor: 'pointer' }}
          >
            {label}
          </button>
        ))}
      </div>

      {draft.mode === 'alternate_weeks' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.gris, display: 'block', marginBottom: 4 }}>Premier jour d’une semaine avec les enfants</label>
          <input
            type="date"
            value={draft.referenceDate}
            onChange={event => setDraft(current => ({ ...current, referenceDate: event.target.value }))}
            style={{ width: '100%', maxWidth: 280, border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '9px 12px', background: C.cream, color: C.noir }}
          />
        </div>
      )}

      {draft.mode === 'fixed_days' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.gris, display: 'block', marginBottom: 6 }}>Jours habituels avec les enfants</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WEEK_DAYS.map(day => {
              const selected = draft.fixedDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  onClick={() => setDraft(current => ({
                    ...current,
                    fixedDays: selected ? current.fixedDays.filter(value => value !== day.value) : [...current.fixedDays, day.value],
                  }))}
                  style={{ width: 46, height: 36, borderRadius: 10, border: `1.5px solid ${selected ? C.rose : C.grisClair}`, background: selected ? C.roseLight : C.cream, color: selected ? C.deep : C.gris, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {draft.mode === 'custom' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.gris, display: 'block', marginBottom: 4 }}>Décris simplement le rythme habituel</label>
          <textarea
            value={draft.note}
            onChange={event => setDraft(current => ({ ...current, note: event.target.value }))}
            rows={2}
            placeholder="Ex. du mercredi soir au samedi après-midi une semaine sur deux"
            style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '9px 12px', background: C.cream, color: C.noir, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: exceptions.length ? 14 : 0 }}>
        <button onClick={saveConfig} disabled={saving} style={{ padding: '10px 16px', borderRadius: 11, border: 'none', background: C.deep, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Enregistrement…' : '✓ Enregistrer le rythme'}
        </button>
        <button onClick={() => setShowException(value => !value)} style={{ padding: '10px 16px', borderRadius: 11, border: `1.5px solid ${C.rose}`, background: C.roseLight, color: C.deep, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + Ajouter une exception
        </button>
      </div>

      {showException && (
        <div style={{ marginTop: 12, padding: 12, background: C.cream, borderRadius: 14, border: `1px solid ${C.grisClair}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: C.gris, display: 'block', marginBottom: 3 }}>Date de début</label>
              <input type="date" value={exceptionStart} onChange={event => { setExceptionStart(event.target.value); if (!exceptionEnd) setExceptionEnd(event.target.value) }} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.gris, display: 'block', marginBottom: 3 }}>Heure de début</label>
              <input type="time" value={exceptionStartTime} onChange={event => setExceptionStartTime(event.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.gris, display: 'block', marginBottom: 3 }}>Date de fin</label>
              <input type="date" min={exceptionStart} value={exceptionEnd} onChange={event => setExceptionEnd(event.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.gris, display: 'block', marginBottom: 3 }}>Heure de fin</label>
              <input type="time" value={exceptionEndTime} onChange={event => setExceptionEndTime(event.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc }} />
            </div>
          </div>
          <p style={{ margin: '-2px 0 8px', fontSize: 10, color: C.gris }}>Les heures sont facultatives. Elles permettent au Planner et à Nova de comprendre une reprise ou un départ en cours de journée.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => setExceptionWithChildren(true)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1.5px solid ${exceptionWithChildren ? C.rose : C.grisClair}`, background: exceptionWithChildren ? C.roseLight : C.blanc, color: C.deep, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Avec les enfants</button>
            <button onClick={() => setExceptionWithChildren(false)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1.5px solid ${!exceptionWithChildren ? '#C77E52' : C.grisClair}`, background: !exceptionWithChildren ? 'rgba(243,205,182,0.32)' : C.blanc, color: C.noir, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Sans les enfants</button>
          </div>
          <input value={exceptionNote} onChange={event => setExceptionNote(event.target.value)} placeholder="Note facultative : échange de semaine, nuit supplémentaire…" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc, boxSizing: 'border-box', marginBottom: 8 }} />
          <button onClick={addException} disabled={!exceptionStart} style={{ width: '100%', padding: '9px', borderRadius: 9, border: 'none', background: exceptionStart ? C.deep : C.grisClair, color: exceptionStart ? 'white' : C.gris, fontWeight: 700, cursor: 'pointer' }}>Valider l’exception</button>
        </div>
      )}

      {exceptions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, color: C.gris, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Exceptions enregistrées</p>
          {exceptions.slice(0, 6).map(exception => (
            <div key={exception.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `1px solid ${C.grisClair}` }}>
              <span style={{ fontSize: 15 }}>{exception.withChildren ? '👧' : '🌿'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.noir }}>{exception.withChildren ? 'Avec les enfants' : 'Sans les enfants'} · {exception.startDate}{exception.startTime ? ` à ${exception.startTime}` : ''}{exception.endDate !== exception.startDate || exception.endTime ? ` → ${exception.endDate}${exception.endTime ? ` à ${exception.endTime}` : ''}` : ''}</p>
                {exception.note && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.gris }}>{exception.note}</p>}
              </div>
              <button onClick={() => onDeleteException(exception.supabaseId || exception.id)} style={{ border: 'none', background: 'rgba(220,80,80,0.07)', color: '#DC5050', borderRadius: 8, width: 28, height: 28, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}


// ─── MODAL MEMBRE ─────────────────────────────────────────────────────────────
function LocationsPanel({
  config,
  onSave,
}: {
  config: LocationConfig
  onSave: (config: LocationConfig) => Promise<void>
}) {
  const [draft, setDraft] = useState<LocationConfig>(config)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => setDraft(config), [config])

  const createPlace = (kind: PlaceKind = 'other') => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `place-${Date.now()}`
    const hasReference = draft.places.some(place => place.isReference)
    const place: RecurringPlace = {
      id,
      kind,
      label: kind === 'home' ? 'Mon domicile' : '',
      address: '',
      approximate: false,
      transportMode: draft.defaultTransportMode,
      travelMinutes: 0,
      safetyMarginMinutes: draft.defaultSafetyMarginMinutes,
      isReference: kind === 'home' && !hasReference,
      icon: PLACE_KIND_ICONS[kind],
      customType: '',
    }
    setDraft(current => ({ ...current, places: [...current.places, place] }))
    setSelectedPlaceId(id)
    setPendingDeleteId(null)
    return id
  }

  const openHome = () => {
    const existingHome = draft.places.find(place => place.kind === 'home')
    const id = existingHome?.id || createPlace('home')
    setSelectedPlaceId(id)
    window.setTimeout(() => {
      document.getElementById('location-place-editor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 50)
  }

  useEffect(() => {
    const handler = () => openHome()
    window.addEventListener('novae:open-home-location', handler)
    return () => window.removeEventListener('novae:open-home-location', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const updatePlace = (id: string, patch: Partial<RecurringPlace>) => {
    setDraft(current => ({
      ...current,
      places: current.places.map(place => {
        if (patch.isReference === true) {
          return place.id === id
            ? { ...place, ...patch, isReference: true }
            : { ...place, isReference: false }
        }
        return place.id === id ? { ...place, ...patch } : place
      }),
    }))
  }

  const updatePlaceKind = (id: string, kind: PlaceKind) => {
    setDraft(current => {
      const hasOtherReference = current.places.some(
        place => place.isReference && place.id !== id,
      )
      return {
        ...current,
        places: current.places.map(place =>
          place.id === id
            ? {
                ...place,
                kind,
                icon: PLACE_KIND_ICONS[kind],
                customType: kind === 'other' ? place.customType || '' : '',
                isReference:
                  kind === 'home' && !hasOtherReference ? true : place.isReference,
              }
            : place,
        ),
      }
    })
  }

  const removePlace = (id: string) => {
    setDraft(current => ({
      ...current,
      places: current.places.filter(place => place.id !== id),
    }))
    setSelectedPlaceId(current => (current === id ? null : current))
    setPendingDeleteId(null)
  }

  const save = async () => {
    const keptPlaces = draft.places
      .map(place => ({
        ...place,
        label: place.label.trim(),
        address: place.address.trim(),
        customType: place.customType?.trim() || '',
        icon: place.icon?.trim() || PLACE_KIND_ICONS[place.kind] || '📍',
      }))
      .filter(place => place.label || place.address)

    const explicitReference = keptPlaces.find(place => place.isReference)
    const fallbackHome = keptPlaces.find(place => place.kind === 'home')
    const referenceId = explicitReference?.id || fallbackHome?.id

    const cleaned: LocationConfig = {
      ...draft,
      places: keptPlaces.map(place => ({
        ...place,
        isReference: Boolean(referenceId && place.id === referenceId),
      })),
    }

    setSaveError('')
    setSaving(true)
    try {
      await onSave(cleaned)
      setDraft(cleaned)
      if (
        selectedPlaceId &&
        !cleaned.places.some(place => place.id === selectedPlaceId)
      ) {
        setSelectedPlaceId(null)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer les lieux pour le moment.'
      console.error('[family/locations] enregistrement impossible', error)
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  const selectedPlace =
    draft.places.find(place => place.id === selectedPlaceId) || null

  return (
    <section
      id="locations-panel"
      style={{
        marginBottom: 24,
        background: C.blanc,
        border: `1.5px solid ${C.grisClair}`,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Organisation quotidienne
          </p>
          <h2 style={{ margin: '3px 0 0', fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.noir }}>
            Lieux et trajets
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.gris }}>
            Tes repères sont enregistrés pour que Nova puisse les utiliser dans ses réponses et ses calculs de départ.
          </p>
        </div>
        <span aria-hidden="true" style={{ fontSize: 28 }}>📍</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8, marginTop: 14 }}>
        <label style={{ fontSize: 11, color: C.gris }}>
          Transport habituel
          <select
            value={draft.defaultTransportMode}
            onChange={event => setDraft(current => ({ ...current, defaultTransportMode: event.target.value as TransportMode }))}
            style={{ width: '100%', minHeight: 44, marginTop: 4, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.cream, color: C.noir }}
          >
            {(Object.entries(TRANSPORT_LABELS) as [TransportMode, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label style={{ fontSize: 11, color: C.gris }}>
          Marge de sécurité par défaut
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              type="number"
              min={0}
              max={180}
              value={draft.defaultSafetyMarginMinutes}
              onChange={event => setDraft(current => ({ ...current, defaultSafetyMarginMinutes: Math.max(0, Number(event.target.value) || 0) }))}
              style={{ width: 90, minHeight: 44, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.cream, color: C.noir }}
            />
            <span style={{ fontSize: 12, color: C.gris }}>minutes</span>
          </div>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(92px,1fr))', gap: 10, marginTop: 16 }}>
        {draft.places.map(place => {
          const title =
            place.kind === 'other' && place.customType?.trim()
              ? place.customType.trim()
              : PLACE_KIND_LABELS[place.kind]
          const isSelected = place.id === selectedPlaceId

          return (
            <button
              key={place.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                setSelectedPlaceId(place.id)
                setPendingDeleteId(null)
              }}
              style={{
                minHeight: 92,
                minWidth: 0,
                padding: '10px 8px',
                borderRadius: 14,
                border: `1.5px solid ${isSelected ? C.deep : C.grisClair}`,
                background: isSelected ? C.roseLight : C.cream,
                color: C.noir,
                cursor: 'pointer',
                textAlign: 'center',
                touchAction: 'manipulation',
              }}
            >
              <span aria-hidden="true" style={{ display: 'block', fontSize: 27, lineHeight: 1 }}>
                {place.icon || PLACE_KIND_ICONS[place.kind]}
              </span>
              <strong style={{ display: 'block', marginTop: 7, fontSize: 11, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                {place.label.trim() || title}
              </strong>
              {place.isReference && (
                <small style={{ display: 'block', marginTop: 4, color: C.deep, fontSize: 9, fontWeight: 700 }}>
                  Départ principal
                </small>
              )}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => createPlace('other')}
          aria-label="Ajouter un lieu"
          style={{
            minHeight: 92,
            padding: '10px 8px',
            borderRadius: 14,
            border: `1.5px dashed ${C.rose}`,
            background: 'rgba(255,255,255,0.45)',
            color: C.deep,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            touchAction: 'manipulation',
          }}
        >
          <span aria-hidden="true" style={{ display: 'block', fontSize: 28, lineHeight: 1 }}>＋</span>
          <span style={{ display: 'block', marginTop: 7 }}>Ajouter</span>
        </button>
      </div>

      {draft.places.length === 0 && (
        <p style={{ margin: '12px 0 0', padding: 12, borderRadius: 12, background: C.cream, color: C.gris, fontSize: 12 }}>
          Aucun lieu enregistré. Commence par ton domicile, puis ajoute uniquement les repères qui te sont utiles.
        </p>
      )}

      {selectedPlace && (
        <div
          id="location-place-editor"
          style={{ marginTop: 14, padding: 14, borderRadius: 16, border: `1px solid ${C.grisClair}`, background: C.cream }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Fiche du lieu
              </p>
              <h3 style={{ margin: '2px 0 0', fontFamily: "'Cormorant Garamond',serif", fontSize: 21, color: C.noir }}>
                {selectedPlace.label || (selectedPlace.kind === 'other' && selectedPlace.customType?.trim() ? selectedPlace.customType : PLACE_KIND_LABELS[selectedPlace.kind])}
              </h3>
            </div>
            <button
              type="button"
              aria-label="Fermer la fiche du lieu"
              onClick={() => {
                setSelectedPlaceId(null)
                setPendingDeleteId(null)
              }}
              style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.grisClair}`, background: C.blanc, color: C.gris, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 9 }}>
            <label style={{ fontSize: 10, color: C.gris }}>
              Type de lieu
              <select
                value={selectedPlace.kind}
                onChange={event => updatePlaceKind(selectedPlace.id, event.target.value as PlaceKind)}
                style={{ width: '100%', minHeight: 44, marginTop: 4, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.blanc, color: C.noir }}
              >
                {(Object.entries(PLACE_KIND_LABELS) as [PlaceKind, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            {selectedPlace.kind === 'other' && (
              <label style={{ fontSize: 10, color: C.gris }}>
                Type personnalisé
                <input
                  value={selectedPlace.customType || ''}
                  onChange={event => updatePlace(selectedPlace.id, { customType: event.target.value })}
                  placeholder="Ex. Gare, salle de sport…"
                  style={{ width: '100%', minHeight: 44, marginTop: 4, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.blanc, color: C.noir, boxSizing: 'border-box' }}
                />
              </label>
            )}

            <label style={{ fontSize: 10, color: C.gris }}>
              Nom du lieu
              <input
                value={selectedPlace.label}
                onChange={event => updatePlace(selectedPlace.id, { label: event.target.value })}
                placeholder="Ex. Lidl Lyon, école d’Inaya…"
                style={{ width: '100%', minHeight: 44, marginTop: 4, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.blanc, color: C.noir, boxSizing: 'border-box' }}
              />
            </label>

            <label style={{ fontSize: 10, color: C.gris }}>
              Adresse
              <input
                value={selectedPlace.address}
                onChange={event => updatePlace(selectedPlace.id, { address: event.target.value })}
                placeholder="Adresse, ville ou code postal"
                autoComplete="street-address"
                style={{ width: '100%', minHeight: 44, marginTop: 4, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.blanc, color: C.noir, boxSizing: 'border-box' }}
              />
            </label>

            <label style={{ fontSize: 10, color: C.gris }}>
              Transport
              <select
                value={selectedPlace.transportMode}
                onChange={event => updatePlace(selectedPlace.id, { transportMode: event.target.value as TransportMode })}
                style={{ width: '100%', minHeight: 44, marginTop: 4, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.blanc, color: C.noir }}
              >
                {(Object.entries(TRANSPORT_LABELS) as [TransportMode, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label style={{ fontSize: 10, color: C.gris }}>
              Trajet habituel
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={selectedPlace.travelMinutes}
                  onChange={event => updatePlace(selectedPlace.id, { travelMinutes: Math.max(0, Number(event.target.value) || 0) })}
                  style={{ width: 90, minHeight: 44, padding: '8px', borderRadius: 9, border: `1px solid ${C.grisClair}`, background: C.blanc }}
                />
                <span>min</span>
              </div>
            </label>

            <label style={{ fontSize: 10, color: C.gris }}>
              Marge de sécurité
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={selectedPlace.safetyMarginMinutes}
                  onChange={event => updatePlace(selectedPlace.id, { safetyMarginMinutes: Math.max(0, Number(event.target.value) || 0) })}
                  style={{ width: 90, minHeight: 44, padding: '8px', borderRadius: 9, border: `1px solid ${C.grisClair}`, background: C.blanc }}
                />
                <span>min</span>
              </div>
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 7px', fontSize: 10, color: C.gris, fontWeight: 700 }}>Icône</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
              {PLACE_ICON_CHOICES.map(icon => (
                <button
                  key={icon}
                  type="button"
                  aria-label={`Choisir l’icône ${icon}`}
                  aria-pressed={selectedPlace.icon === icon}
                  onClick={() => updatePlace(selectedPlace.id, { icon })}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    border: `1.5px solid ${selectedPlace.icon === icon ? C.deep : C.grisClair}`,
                    background: selectedPlace.icon === icon ? C.roseLight : C.blanc,
                    cursor: 'pointer',
                    fontSize: 21,
                  }}
                >
                  {icon}
                </button>
              ))}
              <input
                aria-label="Icône personnalisée"
                value={selectedPlace.icon || ''}
                onChange={event => updatePlace(selectedPlace.id, { icon: event.target.value.slice(0, 4) })}
                placeholder="Autre"
                maxLength={4}
                style={{ width: 72, minHeight: 44, padding: '8px', borderRadius: 11, border: `1px solid ${C.grisClair}`, background: C.blanc, textAlign: 'center', fontSize: 18 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 13 }}>
            <label style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 7, color: C.gris, fontSize: 11 }}>
              <input
                type="checkbox"
                checked={selectedPlace.approximate}
                onChange={event => updatePlace(selectedPlace.id, { approximate: event.target.checked })}
              />
              Adresse approximative
            </label>

            <label style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 7, color: selectedPlace.isReference ? C.deep : C.gris, fontSize: 11, fontWeight: selectedPlace.isReference ? 700 : 500 }}>
              <input
                type="checkbox"
                checked={selectedPlace.isReference}
                onChange={event => updatePlace(selectedPlace.id, { isReference: event.target.checked })}
              />
              Point de départ principal
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            {pendingDeleteId === selectedPlace.id ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, padding: 10, borderRadius: 12, background: 'rgba(198,102,102,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(null)}
                  style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${C.grisClair}`, background: C.blanc, cursor: 'pointer', fontWeight: 700 }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => removePlace(selectedPlace.id)}
                  style={{ minHeight: 44, borderRadius: 10, border: 'none', background: '#B85656', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                >
                  Confirmer la suppression
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPendingDeleteId(selectedPlace.id)}
                style={{ minHeight: 44, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(198,102,102,0.34)', background: 'transparent', color: '#B85656', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
              >
                Supprimer ce lieu
              </button>
            )}
          </div>
        </div>
      )}

      <p style={{ margin: '12px 0 0', fontSize: 11, color: C.gris }}>
        L’adresse exacte reste facultative. Aucune géolocalisation automatique n’est nécessaire : tu choisis les informations enregistrées.
      </p>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{ width: '100%', minHeight: 46, marginTop: 10, padding: '10px 16px', borderRadius: 11, border: 'none', background: C.deep, color: 'white', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}
      >
        {saving ? 'Enregistrement…' : '✓ Enregistrer les lieux et trajets'}
      </button>

      {saveError && (
        <p role="alert" style={{ margin: '8px 0 0', color: '#B64646', fontSize: 12 }}>
          Enregistrement impossible : {saveError}
        </p>
      )}
    </section>
  )
}

function MemberModal({ initial, defaultCategory, onSave, onClose }: {
  initial?: FamilyMember; defaultCategory?: MemberCategory; onSave: (m: FamilyMember) => void; onClose: () => void
}) {
  const [firstName, setFirstName] = useState(initial?.firstName || '')
  const [lastName, setLastName] = useState(initial?.lastName || '')
  const [relation, setRelation] = useState<MemberRelation>(initial?.relation || 'enfant')
  const [gender, setGender] = useState<MemberGender>(initial?.gender || '')
  const [category, setCategory] = useState<MemberCategory>(initial?.category || defaultCategory || 'foyer')
  const [isHouseholdMember, setIsHouseholdMember] = useState(initial?.isHouseholdMember ?? ((initial?.category || defaultCategory || 'foyer') === 'foyer'))
  const [birthDate, setBirthDate] = useState(initial?.birthDate || '')
  const [photo, setPhoto] = useState(initial?.photo || '👩')
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl || '')
  const [clothingSize, setClothingSize] = useState(initial?.clothingSize || '')
  const [shoeSize, setShoeSize] = useState(initial?.shoeSize || '')
  const [allergies, setAllergies] = useState(initial?.allergies || '')
  const [healthNotes, setHealthNotes] = useState(initial?.healthNotes || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [isPrimaryContact, setIsPrimaryContact] = useState(initial?.isPrimaryContact || false)
  const [dietaryRegime, setDietaryRegime] = useState(initial?.dietaryRegime || '')
  const [foodPreferences, setFoodPreferences] = useState(initial?.foodPreferences || '')
  const [foodDislikes, setFoodDislikes] = useState(initial?.foodDislikes || '')
  const [giftIdeas, setGiftIdeas] = useState(initial?.giftIdeas || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [showAvatars, setShowAvatars] = useState(false)
  const [tab, setTab] = useState<'info' | 'details'>('info')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await resizeImage(file)
      setPhotoUrl(dataUrl)
      setShowAvatars(false)
    } catch {
      alert("Impossible de charger cette image, réessaie avec une autre.")
    } finally {
      e.target.value = ''
    }
  }

  const handleSave = () => {
    if (!firstName.trim()) return
    onSave({
      id: initial?.id || Math.random().toString(36).slice(2),
      supabaseId: initial?.supabaseId,
      firstName: firstName.trim(), lastName: lastName.trim(),
      relation, gender, category, isHouseholdMember, birthDate, photo, photoUrl,
      clothingSize, shoeSize, allergies, healthNotes, phone, email, isPrimaryContact,
      dietaryRegime, foodPreferences, foodDislikes, giftIdeas, notes,
    })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 20px 40px' }}>
          <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir }}>
              {initial ? 'Modifier' : 'Ajouter une personne'}
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gris, fontSize: 20 }}>×</button>
          </div>

          {/* Avatar / photo */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, border: `2px solid ${C.grisClair}`, background: C.cream, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Avatar photo={photo} photoUrl={photoUrl} px={photoUrl ? 60 : 38} radius={photoUrl ? 0 : 999} />
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom *" autoFocus
                style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream }} />
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom"
                style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream }} />
            </div>
          </div>

          {/* Choix avatar / photo */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setShowAvatars(!showAvatars)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${showAvatars ? C.rose : C.grisClair}`, background: showAvatars ? C.roseLight : 'white', color: showAvatars ? C.rose : C.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Smile size={14} /> Avatar
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${photoUrl ? C.rose : C.grisClair}`, background: photoUrl ? C.roseLight : 'white', color: photoUrl ? C.rose : C.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Camera size={14} /> Importer une photo
            </button>
            {photoUrl && (
              <button onClick={() => setPhotoUrl('')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 10, border: 'none', background: 'rgba(220,80,80,0.07)', color: '#DC5050', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <X size={13} /> Retirer la photo
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickPhoto} style={{ display: 'none' }} />
          </div>

          {showAvatars && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, padding: 10, background: C.cream, borderRadius: 12 }}>
              {AVATARS.map(a => <button key={a} onClick={() => { setPhoto(a); setPhotoUrl(''); setShowAvatars(false) }} style={{ fontSize: 24, width: 40, height: 40, borderRadius: 10, border: 'none', background: (photo === a && !photoUrl) ? C.roseLight : 'transparent', cursor: 'pointer' }}>{a}</button>)}
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Catégorie</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {CATEGORY_KEYS.map(k => {
              const v = CATEGORIES[k]
              return (
                <button key={k} onClick={() => { setCategory(k); if (k !== 'foyer') setIsHouseholdMember(false); if (k === 'foyer') setIsHouseholdMember(true) }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `2px solid ${category === k ? v.color : C.grisClair}`, background: category === k ? v.bg : 'white', fontSize: 11, fontWeight: category === k ? 700 : 400, color: category === k ? v.color : C.gris, cursor: 'pointer' }}>
                  {v.emoji}<br />{v.label}
                </button>
              )
            })}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', margin: '0 0 14px', borderRadius: 12, background: C.cream, border: `1px solid ${C.grisClair}`, fontSize: 12, color: C.noir, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isHouseholdMember}
              onChange={e => {
                setIsHouseholdMember(e.target.checked)
                if (e.target.checked) setCategory('foyer')
              }}
              style={{ accentColor: C.rose }}
            />
            Cette personne vit dans mon foyer
          </label>

          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Relation</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
            {(Object.entries(RELATIONS) as [MemberRelation, string][]).map(([k, v]) => (
              <button key={k} onClick={() => setRelation(k)}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${relation === k ? C.rose : C.grisClair}`, background: relation === k ? C.roseLight : 'white', fontSize: 11, fontWeight: relation === k ? 700 : 400, color: relation === k ? C.rose : C.gris, cursor: 'pointer' }}>
                {v}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
            Genre <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(facultatif)</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {([
              ['female', '♀ Féminin'],
              ['male', '♂ Masculin'],
            ] as [Exclude<MemberGender, ''>, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGender(gender === value ? '' : value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${gender === value ? C.rose : C.grisClair}`,
                  background: gender === value ? C.roseLight : 'white',
                  color: gender === value ? C.deep : C.gris,
                  fontSize: 12,
                  fontWeight: gender === value ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Date de naissance <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(facultative)</span></p>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
            style={{ width: '100%', border: `1.5px solid ${birthDate ? C.rose : C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const, marginBottom: 14 }} />

          <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.grisClair}`, marginBottom: 14 }}>
            {([['info', '👤 Infos'], ['details', '📝 Notes & Cadeaux']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: '9px 0', border: 'none', background: tab === t ? C.roseLight : 'white', color: tab === t ? C.rose : C.gris, fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Téléphone', value: phone, set: setPhone, placeholder: '06 12 34 56 78' },
                { label: 'E-mail', value: email, set: setEmail, placeholder: 'prenom@email.fr' },
                { label: 'Taille vêtements', value: clothingSize, set: setClothingSize, placeholder: 'M, L, 38...' },
                { label: 'Pointure', value: shoeSize, set: setShoeSize, placeholder: '38, 42...' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                    style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>⚠️ Allergies <span style={{ fontWeight: 400 }}>(séparées par des virgules)</span></label>
                <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="muscade, gluten, lactose..."
                  style={{ width: '100%', border: `1.5px solid ${allergies ? '#E8A0A0' : C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: allergies ? 'rgba(232,160,160,0.06)' : C.cream, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Autres notes santé</label>
                <input value={healthNotes} onChange={e => setHealthNotes(e.target.value)} placeholder="Diabétique, végétarien..."
                  style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Régime ou habitudes alimentaires</label>
                <input value={dietaryRegime} onChange={e => setDietaryRegime(e.target.value)} placeholder="Végétarien, sans porc, halal, repas peu épicés..."
                  style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Aliments et plats appréciés <span style={{ fontWeight: 400 }}>(séparés par des virgules)</span></label>
                <input value={foodPreferences} onChange={e => setFoodPreferences(e.target.value)} placeholder="pâtes, couscous, poulet, légumes croquants..."
                  style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Aliments et plats non appréciés <span style={{ fontWeight: 400 }}>(séparés par des virgules)</span></label>
                <input value={foodDislikes} onChange={e => setFoodDislikes(e.target.value)} placeholder="champignons, poisson, plats très épicés..."
                  style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, boxSizing: 'border-box' as const }} />
              </div>
              <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: C.cream, border: `1px solid ${C.grisClair}`, fontSize: 12, color: C.noir, cursor: 'pointer' }}>
                <input type="checkbox" checked={isPrimaryContact} onChange={e => setIsPrimaryContact(e.target.checked)} style={{ accentColor: C.rose }} />
                Définir comme contact principal de ce cercle
              </label>
            </div>
          )}

          {tab === 'details' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Idées cadeaux 🎁</label>
              <textarea value={giftIdeas} onChange={e => setGiftIdeas(e.target.value)} rows={3} placeholder="Livre, parfum, weekend..."
                style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, resize: 'none', boxSizing: 'border-box' as const, marginBottom: 10 }} />
              <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Notes personnelles</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Préférences, centres d'intérêt..."
                style={{ width: '100%', border: `1.5px solid ${C.grisClair}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', color: C.noir, background: C.cream, resize: 'none', boxSizing: 'border-box' as const }} />
            </div>
          )}

          <button onClick={handleSave} disabled={!firstName.trim()}
            style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: firstName.trim() ? C.deep : C.grisClair, color: firstName.trim() ? 'white' : '#aaa', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {initial ? '✓ Enregistrer' : '+ Ajouter cette personne'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
export default function FamilyPage() {
  const router = useRouter()
  const { user } = useSupabaseAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [custodyConfig, setCustodyConfig] = useState<CustodyConfig>({ mode: 'alternate_weeks', referenceDate: '', fixedDays: [], note: '' })
  const [custodyExceptions, setCustodyExceptions] = useState<CustodyException[]>([])
  const [locationConfig, setLocationConfig] = useState<LocationConfig>({ defaultTransportMode: 'car', defaultSafetyMarginMinutes: 15, places: [] })
  const [showModal, setShowModal] = useState(false)
  const [addCategory, setAddCategory] = useState<MemberCategory | null>(null)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<MemberCategory[]>(['foyer', 'famille', 'proches', 'professionnel'])
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadMembers()
  }, [user])

  useEffect(() => {
  if (!user) return
  logEvent(supabase, user.id, 'module_programme')
}, [user])

  const loadMembers = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('family_data')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    const rows = data || []
    setMembers(rows.filter((row: any) => !row.data_type || row.data_type === 'member').map(fromSupabase))
    const configRow = rows.find((row: any) => row.data_type === 'custody_config')
    if (configRow) setCustodyConfig(custodyConfigFromRow(configRow))
    setCustodyExceptions(rows.filter((row: any) => row.data_type === 'custody_exception').map(custodyExceptionFromRow))
    const locationRow = rows
      .filter((row: any) => row.data_type === 'location_config')
      .sort((left: any, right: any) => {
        const leftTime = new Date(left.updated_at || left.created_at || 0).getTime()
        const rightTime = new Date(right.updated_at || right.created_at || 0).getTime()
        return rightTime - leftTime
      })[0]
    if (locationRow) {
      setLocationConfig(locationConfigFromRow(locationRow))
    } else {
      setLocationConfig({
        defaultTransportMode: 'car',
        defaultSafetyMarginMinutes: 15,
        places: [],
      })
    }
    setLoading(false)
  }

  const saveMember = async (m: FamilyMember) => {
    if (!user) return
    const payload = toSupabase(m, user.id)
    if (m.supabaseId) {
      await supabase.from('family_data').update(payload).eq('id', m.supabaseId)
      setMembers(prev => prev.map(p => p.supabaseId === m.supabaseId ? { ...m } : p))
    } else {
      const { data } = await supabase.from('family_data').insert({
        ...payload,
        created_at: new Date().toISOString(),
      }).select().single()
      if (data) setMembers(prev => [...prev, fromSupabase(data)])
    }
  }


  const saveCustodyConfig = async (config: CustodyConfig) => {
    if (!user) return
    const payload = {
      user_id: user.id,
      data_type: 'custody_config',
      relation_to_user: 'organisation du foyer',
      is_active: true,
      data: {
        mode: config.mode,
        referenceDate: config.referenceDate,
        fixedDays: config.fixedDays,
        note: config.note,
      },
      updated_at: new Date().toISOString(),
    }

    if (config.supabaseId) {
      const { error } = await supabase.from('family_data').update(payload).eq('id', config.supabaseId).eq('user_id', user.id)
      if (error) throw error
      setCustodyConfig(config)
      return
    }

    const { data, error } = await supabase.from('family_data').insert({
      ...payload,
      created_at: new Date().toISOString(),
    }).select().single()
    if (error) throw error
    if (data) setCustodyConfig(custodyConfigFromRow(data))
  }

  const saveLocationConfig = async (config: LocationConfig) => {
    if (!user) return

    const now = new Date().toISOString()
    const payload = {
      user_id: user.id,
      data_type: 'location_config',
      relation_to_user: 'lieux et trajets',
      is_active: true,
      data: {
        defaultTransportMode: config.defaultTransportMode,
        defaultSafetyMarginMinutes: config.defaultSafetyMarginMinutes,
        places: config.places,
      },
      updated_at: now,
    }

    let targetId = config.supabaseId

    if (!targetId) {
      const { data: existingRows, error: existingError } = await supabase
        .from('family_data')
        .select('id,updated_at,created_at')
        .eq('user_id', user.id)
        .eq('data_type', 'location_config')
        .neq('is_active', false)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (existingError) throw existingError
      targetId = existingRows?.[0]?.id
    }

    if (targetId) {
      const { data, error } = await supabase
        .from('family_data')
        .update(payload)
        .eq('id', targetId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setLocationConfig(locationConfigFromRow(data))
      return
    }

    const { data, error } = await supabase
      .from('family_data')
      .insert({ ...payload, created_at: now })
      .select()
      .single()

    if (error) throw error
    if (data) setLocationConfig(locationConfigFromRow(data))
  }

  const addCustodyException = async (exception: Omit<CustodyException, 'id'>) => {
    if (!user) return
    const { data, error } = await supabase.from('family_data').insert({
      user_id: user.id,
      data_type: 'custody_exception',
      relation_to_user: 'exception de garde',
      is_active: true,
      data: {
        startDate: exception.startDate,
        startTime: exception.startTime,
        endDate: exception.endDate,
        endTime: exception.endTime,
        withChildren: exception.withChildren,
        note: exception.note,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single()
    if (error) throw error
    if (data) setCustodyExceptions(current => [...current, custodyExceptionFromRow(data)].sort((a, b) => a.startDate.localeCompare(b.startDate)))
  }

  const deleteCustodyException = async (id: string) => {
    if (!user) return
    const { error } = await supabase.from('family_data').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setCustodyExceptions(current => current.filter(exception => (exception.supabaseId || exception.id) !== id))
  }

  const deleteMember = async (id: string) => {
    if (!confirm('Supprimer ce proche ?')) return
    await supabase.from('family_data').update({ is_active: false }).eq('id', id)
    setMembers(prev => prev.filter(m => m.supabaseId !== id))
  }

  const toggleCategory = (cat: MemberCategory) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const openAdd = (cat: MemberCategory | null) => {
    setAddCategory(cat)
    setShowModal(true)
  }

  const birthdayAlerts = members
    .filter(m => m.birthDate)
    .map(m => ({ member: m, daysUntil: daysUntilBirthday(m.birthDate) }))
    .filter(a => a.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const todayAlerts = birthdayAlerts.filter(a => a.daysUntil === 0)
  const weekAlerts = birthdayAlerts.filter(a => a.daysUntil > 0 && a.daysUntil <= 7)
  const soonAlerts = birthdayAlerts.filter(a => a.daysUntil > 7)

  return (
    <>
    <DemoBanner />
    <div style={{ minHeight: '100vh', background: C.beige, fontFamily: "'DM Sans',sans-serif" }}>
      <Navigation />
      <div className="pb-28">
        <main className="mx-auto w-full max-w-[720px] md:max-w-[1120px] lg:max-w-[1400px] px-4 md:px-8 pt-6">

          <header style={{ marginBottom: 24 }}>
            <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: C.gris, background: 'rgba(61,38,24,0.05)', border: 'none', borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}>
              <ArrowLeft size={13} /> Accueil
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px' }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.deep }}>Mon univers</p>
                  <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.noir }}>Entourage</h1>
                </div>
              </div>
              <button
                type="button"
                aria-label="Ouvrir mon domicile"
                title="Mon domicile"
                onClick={() => {
                  document.getElementById('locations-panel')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                  window.setTimeout(() => {
                    window.dispatchEvent(new Event('novae:open-home-location'))
                  }, 220)
                }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  border: `1px solid ${C.grisClair}`,
                  background: C.blanc,
                  cursor: 'pointer',
                  fontSize: 31,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation',
                }}
              >
                🏠
              </button>
            </div>
          </header>

          {todayAlerts.map(({ member }) => (
            <div key={member.supabaseId} style={{ background: 'linear-gradient(135deg, rgba(185,215,203,0.32), rgba(94,154,130,0.10))', border: `2px solid ${C.rose}`, borderRadius: 16, padding: '14px 16px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 32 }}>🎂</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.noir }}>C'est l'anniversaire de {member.firstName} aujourd'hui !</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: C.gris }}>{calculateAge(member.birthDate)} ans · {RELATIONS[member.relation]}</p>
              </div>
              <Avatar photo={member.photo} photoUrl={member.photoUrl} px={30} />
            </div>
          ))}

          {weekAlerts.length > 0 && (
            <div style={{ background: 'rgba(185,215,203,0.16)', border: `1.5px solid rgba(94,154,130,0.28)`, borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Gift size={16} style={{ color: C.rose }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.rose }}>🎁 Pense aux cadeaux cette semaine !</p>
              </div>
              {weekAlerts.map(({ member, daysUntil }) => (
                <div key={member.supabaseId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: `1px solid ${C.grisClair}` }}>
                  <Avatar photo={member.photo} photoUrl={member.photoUrl} px={24} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.noir }}>{member.firstName}</span>
                    <span style={{ fontSize: 12, color: C.gris }}> · {formatBirthday(member.birthDate)}</span>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: C.roseLight, color: C.rose, fontWeight: 600 }}>Dans {daysUntil}j</span>
                </div>
              ))}
            </div>
          )}

          {soonAlerts.length > 0 && (
            <div style={{ background: C.blanc, border: `1px solid ${C.grisClair}`, borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.gris, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📅 Prochains anniversaires</p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {soonAlerts.slice(0, 6).map(({ member, daysUntil }) => (
                  <div key={member.supabaseId} style={{ flexShrink: 0, textAlign: 'center', padding: '8px 12px', background: C.cream, borderRadius: 12, minWidth: 72 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar photo={member.photo} photoUrl={member.photoUrl} px={28} /></div>
                    <p style={{ margin: '4px 0 1px', fontSize: 10, fontWeight: 600, color: C.noir }}>{member.firstName}</p>
                    <p style={{ margin: 0, fontSize: 9, color: C.gris }}>dans {daysUntil}j</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <CustodyPanel
            config={custodyConfig}
            exceptions={custodyExceptions}
            onSaveConfig={saveCustodyConfig}
            onAddException={addCustodyException}
            onDeleteException={deleteCustodyException}
          />

          <LocationsPanel
            config={locationConfig}
            onSave={saveLocationConfig}
          />

          <button onClick={() => openAdd(null)}
            style={{ width: '100%', maxWidth: 420, padding: '13px 0', borderRadius: 14, border: 'none', background: C.deep, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            <Plus size={18} /> Ajouter une personne
          </button>

          {loading && <p style={{ textAlign: 'center', color: C.gris, fontSize: 13 }}>Chargement...</p>}

          {/* Trame 4 colonnes : 1 col mobile · 2 cols tablette · 4 cols ordi */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 md:items-start">
          {CATEGORY_KEYS.map(cat => {
            const info = CATEGORIES[cat]
            const catMembers = members.filter(m => m.category === cat)
            const isOpen = expandedCategories.includes(cat)
            const isEmpty = catMembers.length === 0

            return (
              <div key={cat}>
                <button
                  onClick={() => { if (!isEmpty) toggleCategory(cat) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.blanc, borderRadius: (isOpen && !isEmpty) ? '16px 16px 0 0' : 16, border: `1.5px solid ${(isOpen && !isEmpty) ? info.color : C.grisClair}`, cursor: isEmpty ? 'default' : 'pointer' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: info.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{info.emoji}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.noir, fontFamily: "'Cormorant Garamond',serif" }}>{info.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.gris }}>{catMembers.length} proche{catMembers.length > 1 ? 's' : ''}</p>
                  </div>
                  {!isEmpty && (
                    <>
                      <div style={{ display: 'flex', marginRight: 6 }}>
                        {catMembers.slice(0, 3).map((m, i) => (
                          <span key={m.id} style={{ marginLeft: i > 0 ? -6 : 0, display: 'inline-flex' }}>
                            <Avatar photo={m.photo} photoUrl={m.photoUrl} px={24} />
                          </span>
                        ))}
                      </div>
                      {isOpen ? <ChevronUp size={18} style={{ color: info.color, flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: C.gris, flexShrink: 0 }} />}
                    </>
                  )}
                </button>

                {isEmpty && (
                  <div style={{ marginTop: 6, padding: '20px 14px', textAlign: 'center', background: C.blanc, borderRadius: 14, border: `1.5px dashed ${C.grisClair}` }}>
                    <p style={{ margin: '0 0 12px', fontSize: 12, color: C.gris }}>Personne ici pour l'instant</p>
                    <button onClick={() => openAdd(cat)}
                      style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: C.roseLight, color: C.rose, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                )}

                {!isEmpty && isOpen && (
                  <div style={{ background: C.blanc, border: `1.5px solid ${info.color}`, borderTop: 'none', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                    <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    {catMembers.map((member, i) => {
                      const days = member.birthDate ? daysUntilBirthday(member.birthDate) : 9999
                      const isExpanded = expandedMember === member.id
                      const hasBirthdayAlert = days <= 7

                      return (
                        <div key={member.id} style={{ borderTop: i > 0 ? `1px solid ${C.grisClair}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: hasBirthdayAlert ? 'rgba(185,215,203,0.20)' : 'transparent' }}>
                            <button onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                              style={{ width: 44, height: 44, borderRadius: 14, background: member.photoUrl ? 'transparent' : info.bg, border: `2px solid ${hasBirthdayAlert ? C.rose : 'transparent'}`, cursor: 'pointer', flexShrink: 0, overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Avatar photo={member.photo} photoUrl={member.photoUrl} px={member.photoUrl ? 40 : 26} radius={member.photoUrl ? 11 : 999} />
                            </button>
                            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.noir }}>{member.firstName} {member.lastName}</p>
                                {hasBirthdayAlert && <span style={{ fontSize: 14 }}>🎂</span>}
                                {member.isPrimaryContact && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: C.roseLight, color: C.deep, border: `1px solid ${C.rose}` }}>Contact principal</span>}
                                {member.allergies && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(232,100,100,0.1)', color: '#C04040', border: '1px solid rgba(232,100,100,0.25)' }}>⚠️ Allergie</span>}
                              </div>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: C.gris }}>
                                {RELATIONS[member.relation]}
                                {member.birthDate ? ` · ${calculateAge(member.birthDate)} ans · ${formatBirthday(member.birthDate)}` : ''}
                                {member.birthDate ? (days === 0 ? ' 🎉 Aujourd\'hui !' : days <= 7 ? ` · dans ${days}j` : '') : ''}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button onClick={() => setEditingMember(member)}
                                style={{ width: 30, height: 30, borderRadius: 8, background: C.cream, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gris }}>
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => deleteMember(member.supabaseId!)}
                                style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(220,80,80,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC5050' }}>
                                <X size={13} />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0 16px 14px', background: 'rgba(248,241,229,0.6)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
                                {member.phone && (
                                  <div style={{ padding: '8px 10px', background: C.blanc, borderRadius: 10, border: `1px solid ${C.grisClair}` }}>
                                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.gris }}>📱 Téléphone</p>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.noir }}>{member.phone}</p>
                                  </div>
                                )}
                                {member.email && (
                                  <div style={{ padding: '8px 10px', background: C.blanc, borderRadius: 10, border: `1px solid ${C.grisClair}` }}>
                                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.gris }}>✉️ E-mail</p>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.noir, overflowWrap: 'anywhere' }}>{member.email}</p>
                                  </div>
                                )}
                                {member.clothingSize && (
                                  <div style={{ padding: '8px 10px', background: C.blanc, borderRadius: 10, border: `1px solid ${C.grisClair}` }}>
                                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.gris }}>👕 Taille</p>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.noir }}>{member.clothingSize}</p>
                                  </div>
                                )}
                                {member.shoeSize && (
                                  <div style={{ padding: '8px 10px', background: C.blanc, borderRadius: 10, border: `1px solid ${C.grisClair}` }}>
                                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.gris }}>👟 Pointure</p>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.noir }}>{member.shoeSize}</p>
                                  </div>
                                )}
                              </div>
                              {member.allergies && (
                                <div style={{ padding: '8px 12px', background: 'rgba(232,100,100,0.06)', borderRadius: 10, border: '1px solid rgba(232,100,100,0.2)', marginBottom: 6 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 10, color: '#C04040', fontWeight: 700 }}>⚠️ Allergies</p>
                                  <p style={{ margin: 0, fontSize: 12, color: C.noir }}>{member.allergies}</p>
                                </div>
                              )}
                              {member.healthNotes && (
                                <div style={{ padding: '8px 12px', background: 'rgba(255,200,100,0.08)', borderRadius: 10, border: '1px solid rgba(255,200,100,0.25)', marginBottom: 6 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 10, color: '#8A6010', fontWeight: 600 }}>⚕️ Santé</p>
                                  <p style={{ margin: 0, fontSize: 12, color: C.noir }}>{member.healthNotes}</p>
                                </div>
                              )}
                              {member.dietaryRegime && (
                                <div style={{ padding: '8px 12px', background: C.roseLight, borderRadius: 10, border: `1px solid ${C.rose}`, marginBottom: 6 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 10, color: C.deep, fontWeight: 700 }}>🍽️ Régime et habitudes</p>
                                  <p style={{ margin: 0, fontSize: 12, color: C.noir }}>{member.dietaryRegime}</p>
                                </div>
                              )}
                              {member.foodPreferences && (
                                <div style={{ padding: '8px 12px', background: 'rgba(100,180,120,0.08)', borderRadius: 10, border: '1px solid rgba(100,180,120,0.24)', marginBottom: 6 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 10, color: '#477A52', fontWeight: 700 }}>👍 Aime</p>
                                  <p style={{ margin: 0, fontSize: 12, color: C.noir }}>{member.foodPreferences}</p>
                                </div>
                              )}
                              {member.foodDislikes && (
                                <div style={{ padding: '8px 12px', background: 'rgba(220,120,100,0.06)', borderRadius: 10, border: '1px solid rgba(220,120,100,0.2)', marginBottom: 6 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 10, color: '#A65345', fontWeight: 700 }}>👎 N’aime pas</p>
                                  <p style={{ margin: 0, fontSize: 12, color: C.noir }}>{member.foodDislikes}</p>
                                </div>
                              )}
                              {member.giftIdeas && (
                                <div style={{ padding: '8px 12px', background: 'rgba(232,208,128,0.1)', borderRadius: 10, border: '1px solid rgba(232,208,128,0.3)', marginBottom: 6 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A6010', fontWeight: 600 }}>🎁 Idées cadeaux</p>
                                  <p style={{ margin: 0, fontSize: 12, color: C.noir, lineHeight: 1.4 }}>{member.giftIdeas}</p>
                                </div>
                              )}
                              {member.notes && (
                                <div style={{ padding: '8px 12px', background: C.blanc, borderRadius: 10, border: `1px solid ${C.grisClair}` }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 10, color: C.gris, fontWeight: 600 }}>📝 Notes</p>
                                  <p style={{ margin: 0, fontSize: 12, color: C.noir }}>{member.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </main>
      </div>

      {showModal && <MemberModal defaultCategory={addCategory ?? undefined} onSave={saveMember} onClose={() => { setShowModal(false); setAddCategory(null) }} />}
      {editingMember && <MemberModal initial={editingMember} onSave={saveMember} onClose={() => setEditingMember(null)} />}
    </div>
    </>
  )
}