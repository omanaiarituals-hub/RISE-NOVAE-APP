import { useState } from 'react'
// src/components/ConsentementCommercial.tsx
'use client'

interface Props {
  onComplete: (consent: boolean) => void
}

export default function ConsentementCommercial({ onComplete }: Props) {
  const [checked, setChecked] = useState(false)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <p style={{ fontSize: 24, marginBottom: 8 }}>🤝</p>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, marginBottom: 12 }}>
        Contribuer à la recherche NOVAÉ
      </h2>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
        En activant cette option, tes <strong>données démographiques anonymisées</strong> 
        (tranche d'âge, situation familiale, région) et tes <strong>habitudes d'utilisation 
        agrégées</strong> (modules les plus utilisés) pourront contribuer à des études 
        et des partenariats soigneusement sélectionnés par NOVAÉ.
        <br /><br />
        Jamais ton nom, ton email, ni tes données personnelles. 
        Jamais de spam. Retrait possible à tout moment dans Paramètres.
      </p>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, 
                      textAlign: 'left', cursor: 'pointer', marginBottom: 32 }}>
        <input 
          type="checkbox" 
          checked={checked} 
          onChange={e => setChecked(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
          J'accepte que mes données démographiques anonymisées et mes habitudes 
          d'utilisation agrégées soient utilisées par NOVAÉ à des fins d'études 
          et de partenariats commerciaux.
        </span>
      </label>

      <button 
        onClick={() => onComplete(checked)}
        style={{ 
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          background: '#C4848E', color: '#fff', fontSize: 15, 
          fontFamily: "'DM Sans', sans-serif", cursor: 'pointer'
        }}
      >
        {checked ? 'Continuer avec mon accord →' : 'Continuer sans activer →'}
      </button>
    </div>
  )
}