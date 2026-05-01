'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp, Edit2, Gift } from 'lucide-react'
import { DemoBanner } from '@/components/DemoBanner'

type MemberCategory = 'famille' | 'amis' | 'collegues' | 'autres'
type MemberRelation = 'conjoint' | 'enfant' | 'parent' | 'frere_soeur' | 'neveu_niece' | 'ami' | 'collegue' | 'autre'

interface FamilyMember {
  id: string
  // stocké dans le champ `data` JSONB
  firstName: string
  lastName: string
  relation: MemberRelation
  category: MemberCategory
  birthDate: string
  photo: string
  clothingSize: string
  shoeSize: string
  allergies: string      // ex: "muscade, gluten"
  healthNotes: string
  phone: string
  giftIdeas: string
  notes: string
  // champs Supabase directs
  supabaseId?: string
  relation_to_user?: string
}

const C = {
  cream: '#FAF7F2', rose: '#C4956A', roseLight: 'rgba(196,149,106,0.1)',
  violet: '#7B6FA0', violetLight: 'rgba(123,111,160,0.1)',
  noir: '#2C2C2C', gris: '#6B6B6B', grisClair: '#E8E4DF', blanc: '#FFFFFF',
}

const RELATIONS: Record<MemberRelation, string> = {
  conjoint: '💑 Conjoint(e)', enfant: '👶 Enfant', parent: '👨‍👩‍👧 Parent',
  frere_soeur: '👫 Frère/Sœur', neveu_niece: '🧒 Neveu/Nièce',
  ami: '🤝 Ami(e)', collegue: '💼 Collègue', autre: '⭐ Autre',
}

const CATEGORIES: Record<MemberCategory, { label: string; emoji: string; color: string; bg: string }> = {
  famille:   { label: 'Famille',   emoji: '🏠', color: C.rose,   bg: C.roseLight },
  amis:      { label: 'Amis',      emoji: '🤝', color: C.violet, bg: C.violetLight },
  collegues: { label: 'Collègues', emoji: '💼', color: '#A0BEDC', bg: 'rgba(160,190,220,0.1)' },
  autres:    { label: 'Autres',    emoji: '⭐', color: '#E8D080', bg: 'rgba(232,208,128,0.1)' },
}

const AVATARS = ['👩','👨','👧','👦','👶','🧑','👩‍🦱','👨‍🦱','👩‍🦰','👨‍🦰','🧒','👴','👵','🧔','👩‍🦳','👨‍🦳']

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

// Convertit une ligne Supabase en FamilyMember
function fromSupabase(row: any): FamilyMember {
  const d = row.data || {}
  return {
    id: row.id,
    supabaseId: row.id,
    firstName: d.firstName || d.name || '',
    lastName: d.lastName || '',
    relation: d.relation || 'autre',
    category: d.category || 'famille',
    birthDate: d.birthDate || d.birthday || '',
    photo: d.photo || '👤',
    clothingSize: d.clothingSize || '',
    shoeSize: d.shoeSize || '',
    allergies: Array.isArray(d.allergies) ? d.allergies.join(', ') : (d.allergies || d.healthNotes || ''),
    healthNotes: d.healthNotes || '',
    phone: d.phone || '',
    giftIdeas: d.giftIdeas || '',
    notes: d.notes || '',
    relation_to_user: row.relation_to_user || '',
  }
}

// Convertit un FamilyMember en objet Supabase
function toSupabase(m: FamilyMember, userId: string) {
  const allergiesList = m.allergies
    ? m.allergies.split(',').map(a => a.trim()).filter(Boolean)
    : []
  return {
    user_id: userId,
    data_type: 'member',
    relation_to_user: RELATIONS[m.relation] || m.relation,
    is_active: true,
    data: {
      firstName: m.firstName,
      lastName: m.lastName,
      name: m.firstName + (m.lastName ? ' ' + m.lastName : ''),
      relation: m.relation,
      category: m.category,
      birthDate: m.birthDate,
      birthday: m.birthDate,
      photo: m.photo,
      clothingSize: m.clothingSize,
      shoeSize: m.shoeSize,
      allergies: allergiesList,
      healthNotes: m.healthNotes,
      phone: m.phone,
      giftIdeas: m.giftIdeas,
      notes: m.notes,
    },
    updated_at: new Date().toISOString(),
  }
}

// ─── MODAL MEMBRE ─────────────────────────────────────────────────────────────
function MemberModal({ initial, onSave, onClose }: {
  initial?: FamilyMember; onSave: (m: FamilyMember) => void; onClose: () => void
}) {
  const [firstName, setFirstName] = useState(initial?.firstName || '')
  const [lastName, setLastName] = useState(initial?.lastName || '')
  const [relation, setRelation] = useState<MemberRelation>(initial?.relation || 'enfant')
  const [category, setCategory] = useState<MemberCategory>(initial?.category || 'famille')
  const [birthDate, setBirthDate] = useState(initial?.birthDate || '')
  const [photo, setPhoto] = useState(initial?.photo || '👩')
  const [clothingSize, setClothingSize] = useState(initial?.clothingSize || '')
  const [shoeSize, setShoeSize] = useState(initial?.shoeSize || '')
  const [allergies, setAllergies] = useState(initial?.allergies || '')
  const [healthNotes, setHealthNotes] = useState(initial?.healthNotes || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [giftIdeas, setGiftIdeas] = useState(initial?.giftIdeas || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [showAvatars, setShowAvatars] = useState(false)
  const [tab, setTab] = useState<'info' | 'details'>('info')

  const handleSave = () => {
    if (!firstName.trim() || !birthDate) return
    onSave({
      id: initial?.id || Math.random().toString(36).slice(2),
      supabaseId: initial?.supabaseId,
      firstName: firstName.trim(), lastName: lastName.trim(),
      relation, category, birthDate, photo,
      clothingSize, shoeSize, allergies, healthNotes, phone, giftIdeas, notes,
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
              {initial ? 'Modifier' : 'Ajouter un proche'}
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gris, fontSize: 20 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
            <button onClick={() => setShowAvatars(!showAvatars)}
              style={{ width: 60, height: 60, borderRadius: 18, border: `2px solid ${showAvatars ? C.rose : C.grisClair}`, background: C.cream, fontSize: 32, cursor: 'pointer', flexShrink: 0 }}>
              {photo}
            </button>
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom *" autoFocus
                style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream }} />
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom"
                style={{ flex: 1, border: `1.5px solid ${C.grisClair}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream }} />
            </div>
          </div>
          {showAvatars && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, padding: 10, background: C.cream, borderRadius: 12 }}>
              {AVATARS.map(a => <button key={a} onClick={() => { setPhoto(a); setShowAvatars(false) }} style={{ fontSize: 24, width: 40, height: 40, borderRadius: 10, border: 'none', background: photo === a ? C.roseLight : 'transparent', cursor: 'pointer' }}>{a}</button>)}
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Catégorie</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(Object.entries(CATEGORIES) as [MemberCategory, any][]).map(([k, v]) => (
              <button key={k} onClick={() => setCategory(k)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `2px solid ${category === k ? v.color : C.grisClair}`, background: category === k ? v.bg : 'white', fontSize: 11, fontWeight: category === k ? 700 : 400, color: category === k ? v.color : C.gris, cursor: 'pointer' }}>
                {v.emoji}<br />{v.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Relation</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
            {(Object.entries(RELATIONS) as [MemberRelation, string][]).map(([k, v]) => (
              <button key={k} onClick={() => setRelation(k)}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${relation === k ? C.rose : C.grisClair}`, background: relation === k ? C.roseLight : 'white', fontSize: 11, fontWeight: relation === k ? 700 : 400, color: relation === k ? C.rose : C.gris, cursor: 'pointer' }}>
                {v}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Date de naissance *</p>
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

          <button onClick={handleSave} disabled={!firstName.trim() || !birthDate}
            style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: firstName.trim() && birthDate ? C.rose : C.grisClair, color: firstName.trim() && birthDate ? 'white' : '#aaa', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {initial ? '✓ Enregistrer' : '+ Ajouter ce proche'}
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
  const [showModal, setShowModal] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<MemberCategory[]>(['famille', 'amis'])
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadMembers()
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
    setMembers((data || []).map(fromSupabase))
    setLoading(false)
  }

  const saveMember = async (m: FamilyMember) => {
    if (!user) return
    const payload = toSupabase(m, user.id)
    if (m.supabaseId) {
      // Mise à jour
      await supabase.from('family_data').update(payload).eq('id', m.supabaseId)
      setMembers(prev => prev.map(p => p.supabaseId === m.supabaseId ? { ...m } : p))
    } else {
      // Création
      const { data } = await supabase.from('family_data').insert({
        ...payload,
        created_at: new Date().toISOString(),
      }).select().single()
      if (data) setMembers(prev => [...prev, fromSupabase(data)])
    }
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
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
      <Navigation />
      <div className="md:ml-64 pb-24 md:pb-8">
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>

          <header style={{ marginBottom: 24 }}>
            <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: C.gris, background: 'rgba(44,44,44,0.05)', border: 'none', borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}>
              <ArrowLeft size={13} /> Accueil
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px' }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.noir }}>Famille & Proches</h1>
              </div>
              <span style={{ fontSize: 40 }}>🏠</span>
            </div>
          </header>

          {/* Alertes anniversaires */}
          {todayAlerts.map(({ member }) => (
            <div key={member.supabaseId} style={{ background: 'linear-gradient(135deg, rgba(196,149,106,0.15), rgba(232,208,128,0.1))', border: `2px solid ${C.rose}`, borderRadius: 16, padding: '14px 16px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 32 }}>🎂</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.noir }}>C'est l'anniversaire de {member.firstName} aujourd'hui !</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: C.gris }}>{calculateAge(member.birthDate)} ans · {RELATIONS[member.relation]}</p>
              </div>
              <span style={{ fontSize: 24 }}>{member.photo}</span>
            </div>
          ))}

          {weekAlerts.length > 0 && (
            <div style={{ background: 'rgba(196,149,106,0.07)', border: `1.5px solid rgba(196,149,106,0.25)`, borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Gift size={16} style={{ color: C.rose }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.rose }}>🎁 Pense aux cadeaux cette semaine !</p>
              </div>
              {weekAlerts.map(({ member, daysUntil }) => (
                <div key={member.supabaseId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: `1px solid ${C.grisClair}` }}>
                  <span style={{ fontSize: 20 }}>{member.photo}</span>
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
                    <span style={{ fontSize: 22 }}>{member.photo}</span>
                    <p style={{ margin: '4px 0 1px', fontSize: 10, fontWeight: 600, color: C.noir }}>{member.firstName}</p>
                    <p style={{ margin: 0, fontSize: 9, color: C.gris }}>dans {daysUntil}j</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setShowModal(true)}
            style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: C.rose, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            <Plus size={18} /> Ajouter un proche
          </button>

          {loading && <p style={{ textAlign: 'center', color: C.gris, fontSize: 13 }}>Chargement...</p>}

          {(Object.entries(CATEGORIES) as [MemberCategory, any][]).map(([cat, info]) => {
            const catMembers = members.filter(m => m.category === cat)
            if (catMembers.length === 0) return null
            const isOpen = expandedCategories.includes(cat)

            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <button onClick={() => toggleCategory(cat)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.blanc, borderRadius: isOpen ? '16px 16px 0 0' : 16, border: `1.5px solid ${isOpen ? info.color : C.grisClair}`, cursor: 'pointer' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: info.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{info.emoji}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.noir, fontFamily: "'Cormorant Garamond',serif" }}>{info.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.gris }}>{catMembers.length} proche{catMembers.length > 1 ? 's' : ''}</p>
                  </div>
                  <div style={{ display: 'flex', marginRight: 6 }}>
                    {catMembers.slice(0, 3).map((m, i) => (
                      <span key={m.id} style={{ fontSize: 20, marginLeft: i > 0 ? -6 : 0 }}>{m.photo}</span>
                    ))}
                  </div>
                  {isOpen ? <ChevronUp size={18} style={{ color: info.color, flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: C.gris, flexShrink: 0 }} />}
                </button>

                {isOpen && (
                  <div style={{ background: C.blanc, border: `1.5px solid ${info.color}`, borderTop: 'none', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                    {catMembers.map((member, i) => {
                      const days = daysUntilBirthday(member.birthDate)
                      const isExpanded = expandedMember === member.id
                      const hasBirthdayAlert = days <= 7

                      return (
                        <div key={member.id} style={{ borderTop: i > 0 ? `1px solid ${C.grisClair}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: hasBirthdayAlert ? 'rgba(196,149,106,0.04)' : 'transparent' }}>
                            <button onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                              style={{ width: 44, height: 44, borderRadius: 14, background: info.bg, border: `2px solid ${hasBirthdayAlert ? C.rose : 'transparent'}`, fontSize: 26, cursor: 'pointer', flexShrink: 0 }}>
                              {member.photo}
                            </button>
                            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.noir }}>{member.firstName} {member.lastName}</p>
                                {hasBirthdayAlert && <span style={{ fontSize: 14 }}>🎂</span>}
                                {member.allergies && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(232,100,100,0.1)', color: '#C04040', border: '1px solid rgba(232,100,100,0.25)' }}>⚠️ Allergie</span>}
                              </div>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: C.gris }}>
                                {RELATIONS[member.relation]} · {calculateAge(member.birthDate)} ans · {formatBirthday(member.birthDate)}
                                {days === 0 ? ' 🎉 Aujourd\'hui !' : days <= 7 ? ` · dans ${days}j` : ''}
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
                            <div style={{ padding: '0 16px 14px', background: 'rgba(250,247,242,0.5)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
                                {member.phone && (
                                  <div style={{ padding: '8px 10px', background: C.blanc, borderRadius: 10, border: `1px solid ${C.grisClair}` }}>
                                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.gris }}>📱 Téléphone</p>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.noir }}>{member.phone}</p>
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
                )}
              </div>
            )
          })}

          {!loading && members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: C.blanc, borderRadius: 20, border: `1.5px dashed ${C.grisClair}` }}>
              <p style={{ fontSize: 48, marginBottom: 12 }}>🏠</p>
              <p style={{ fontSize: 16, fontFamily: "'Cormorant Garamond',serif", color: C.noir, marginBottom: 6 }}>Ajoute tes proches</p>
              <p style={{ fontSize: 13, color: C.gris, marginBottom: 20 }}>Famille, amis, neveux... et ne rate plus jamais un anniversaire !</p>
              <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: C.rose, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Ajouter un proche
              </button>
            </div>
          )}
        </main>
      </div>

      {showModal && <MemberModal onSave={saveMember} onClose={() => setShowModal(false)} />}
      {editingMember && <MemberModal initial={editingMember} onSave={saveMember} onClose={() => setEditingMember(null)} />}
    </div>
    </>
  )
}