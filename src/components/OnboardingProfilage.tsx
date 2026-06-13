// src/components/OnboardingProfilage.tsx
// Étape UNIQUE de profilage (7 champs sur une seule page) à afficher
// à la fin de l'onboarding, juste avant la génération du debrief.
//
// Champs catégorisables = sélecteurs/boutons (exploitables pour segmentation B2B)
// Rêve = réponse libre (expression personnelle, exploitée par NOVA)
//
// Usage : ce composant remonte les valeurs via onComplete(data).
// Voir GUIDE pour l'intégration dans onboarding/page.tsx

'use client'

import { useState } from 'react'

const TRANCHES_AGE = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55+']
const SECTEURS = [
  'Santé / Social', 'Éducation', 'Commerce / Vente', 'Administration / Bureau',
  'Arts / Création', 'Tech / Numérique', 'Entrepreneuriat', 'Au foyer', 'En recherche', 'Autre',
]
const ENFANTS_TRANCHES = ['0-3 ans', '4-6 ans', '7-11 ans', '12-17 ans', '18 ans et +']
const INTERETS = [
  'Lecture', 'Sport / Fitness', 'Cuisine', 'Voyages', 'Spiritualité / Méditation',
  'Art / Créativité', 'Nature', 'Musique', 'Développement personnel', 'Mode / Beauté',
  'Famille', 'Entrepreneuriat',
]

const GOLD = '#C4956A'

export interface ProfilageData {
  tranche_age: string
  secteur_activite: string
  localisation: string
  a_enfants: string
  enfants_tranches: string
  centres_interet: string
  reve: string
}

export default function OnboardingProfilage({ onComplete }: { onComplete: (data: ProfilageData) => void }) {
  const [d, setD] = useState<ProfilageData>({
    tranche_age: '', secteur_activite: '', localisation: '',
    a_enfants: '', enfants_tranches: '', centres_interet: '', reve: '',
  })

  const interets = d.centres_interet ? d.centres_interet.split(', ').filter(Boolean) : []
  const enfants = d.enfants_tranches ? d.enfants_tranches.split(', ').filter(Boolean) : []

  const toggleInteret = (val: string) => {
    let next: string[]
    if (interets.includes(val)) next = interets.filter(v => v !== val)
    else if (interets.length < 3) next = [...interets, val]
    else next = interets
    setD({ ...d, centres_interet: next.join(', ') })
  }
  const toggleEnfant = (val: string) => {
    const next = enfants.includes(val) ? enfants.filter(v => v !== val) : [...enfants, val]
    setD({ ...d, enfants_tranches: next.join(', ') })
  }

  // Validation : tous les champs catégorisables remplis (rêve optionnel mais encouragé)
  const isValid = d.tranche_age && d.secteur_activite && d.localisation.trim() && d.a_enfants &&
    interets.length > 0 && (d.a_enfants === 'Non' || enfants.length > 0)

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '8px 15px', borderRadius: 999, fontSize: 13.5, cursor: 'pointer',
    border: `1.5px solid ${active ? GOLD : 'rgba(0,0,0,0.12)'}`,
    background: active ? `${GOLD}1A` : '#fff', color: active ? GOLD : '#555',
    fontWeight: active ? 600 : 400, transition: 'all 0.15s',
  })
  const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#3d2618', marginBottom: 10, display: 'block' }
  const input: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
    border: '1.5px solid rgba(0,0,0,0.12)', outline: 'none', fontFamily: 'inherit',
  }
  const block: React.CSSProperties = { marginBottom: 26 }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 4px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🌸</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: '#3d2618', margin: '0 0 6px' }}>
          Pour finir, parle-moi un peu de toi
        </h2>
        <p style={{ fontSize: 13.5, color: '#8c7a68', margin: 0, lineHeight: 1.5 }}>
          Ces infos restent privées et aident NOVA à t'accompagner vraiment.
        </p>
      </div>

      {/* Tranche d'âge */}
      <div style={block}>
        <label style={label}>🎂 Ta tranche d'âge</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TRANCHES_AGE.map(t => (
            <button key={t} onClick={() => setD({ ...d, tranche_age: t })} style={chip(d.tranche_age === t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Secteur */}
      <div style={block}>
        <label style={label}>💼 Ton secteur d'activité</label>
        <select value={d.secteur_activite} onChange={e => setD({ ...d, secteur_activite: e.target.value })} style={input}>
          <option value="">— Choisir —</option>
          {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Localisation */}
      <div style={block}>
        <label style={label}>📍 Où vis-tu ?</label>
        <input type="text" value={d.localisation} onChange={e => setD({ ...d, localisation: e.target.value })}
          placeholder="Ex: Île-de-France, Belgique, Québec…" style={input} />
      </div>

      {/* Enfants */}
      <div style={block}>
        <label style={label}>👶 As-tu des enfants ?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Oui', 'Non'].map(o => (
            <button key={o} onClick={() => setD({ ...d, a_enfants: o, enfants_tranches: o === 'Non' ? '' : d.enfants_tranches })} style={chip(d.a_enfants === o)}>{o}</button>
          ))}
        </div>
      </div>

      {/* Âge enfants — conditionnel */}
      {d.a_enfants === 'Oui' && (
        <div style={block}>
          <label style={label}>🧸 Quel âge ont-ils ?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ENFANTS_TRANCHES.map(t => (
              <button key={t} onClick={() => toggleEnfant(t)} style={chip(enfants.includes(t))}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Intérêts */}
      <div style={block}>
        <label style={label}>✨ Ce qui te passionne <span style={{ color: '#bbb', fontWeight: 400 }}>(jusqu'à 3)</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {INTERETS.map(i => (
            <button key={i} onClick={() => toggleInteret(i)} style={chip(interets.includes(i))}>{i}</button>
          ))}
        </div>
      </div>

      {/* Rêve — réponse libre */}
      <div style={block}>
        <label style={label}>🌟 Ton plus grand rêve en ce moment</label>
        <textarea value={d.reve} onChange={e => setD({ ...d, reve: e.target.value })}
          placeholder="Celui qui te fait vibrer. Écris-le sans filtre — NOVA s'en souviendra pour te le rappeler quand tu en auras besoin."
          rows={4} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
      </div>

      <button onClick={() => onComplete(d)} disabled={!isValid}
        style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none',
          cursor: isValid ? 'pointer' : 'not-allowed',
          background: isValid ? GOLD : 'rgba(0,0,0,0.12)',
          color: isValid ? '#fff' : '#999', fontWeight: 600, fontSize: 15, transition: 'all 0.2s' }}>
        ✨ Générer mon profil
      </button>
      {!isValid && (
        <p style={{ fontSize: 12, color: '#bbb', textAlign: 'center', marginTop: 10 }}>
          Remplis les champs ci-dessus pour continuer (le rêve est optionnel mais précieux).
        </p>
      )}
    </div>
  )
}