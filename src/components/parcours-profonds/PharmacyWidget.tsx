// components/parcours-profonds/PharmacyWidget.tsx
'use client'

import { useState } from 'react'

const EMERGENCY_NUMBERS = [
  { country: 'France', items: ['3114 — Numéro national de prévention du suicide (gratuit, 24h/24)', '01 45 39 40 00 — SOS Amitié (écoute, 24h/24)'] },
  { country: 'Belgique', items: ['1813 — Centre de Prévention du Suicide (24h/24)', '106 — Télé-Accueil (écoute, 24h/24)'] },
  { country: 'Suisse', items: ['143 — La Main Tendue (24h/24)'] },
  { country: 'Canada / Québec', items: ['1-866-277-3553 — Ligne québécoise de prévention du suicide (24h/24)'] }
]

export default function PharmacyWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Besoin d'aide, voir les numéros d'urgence"
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-[#EAF1E8] border border-[#C3D6C2]/60 shadow-md flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="#5C7A66" strokeWidth="1.6" />
          <path d="M12 8V16M8 12H16" stroke="#5C7A66" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4 pb-4 sm:pb-0"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-cream p-6 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-lg font-medium text-[#4D7257]">Besoin d'en parler ?</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-[#EAF1E8] flex items-center justify-center text-[#4D7257] text-lg flex-shrink-0"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-[#6B6B66] mb-5 leading-relaxed">
              Ce parcours est un espace de bien-être, pas un accompagnement médical. Si tu as besoin de parler à quelqu'un, ces ressources sont disponibles à tout moment.
            </p>

            <div className="space-y-4">
              {EMERGENCY_NUMBERS.map(group => (
                <div key={group.country}>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#7FA086] mb-1.5">
                    {group.country}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map(item => (
                      <li key={item} className="text-sm text-[#3A3A36]">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}