'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * À ajouter en haut de chaque vraie page (program, planner, routines, etc.)
 * S'affiche uniquement si le flag 'novae-demo-mode' est dans localStorage.
 * 
 * Usage : <DemoBanner />
 * 
 * Exemple dans app/program/page.tsx :
 *   import { DemoBanner } from '@/components/DemoBanner'
 *   ...
 *   return (
 *     <>
 *       <DemoBanner />
 *       ... reste de la page
 *     </>
 *   )
 */

export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    const flag = localStorage.getItem('novae-demo-mode')
    setIsDemo(flag === 'true')
  }, [])

  if (!isDemo) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1A1A1A 0%, #2A1F15 100%)',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Retour accueil démo */}
      <Link
        href="/demo/app"
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        ← Accueil démo
      </Link>

      <span style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
        MODE DÉMO · Aucune donnée enregistrée
      </span>

      {/* Quitter le mode démo */}
      <button
        onClick={() => {
          localStorage.removeItem('novae-demo-mode')
          localStorage.removeItem('novae-demo-back')
          window.location.href = '/'
        }}
        style={{ background: 'transparent', border: '1px solid rgba(196,149,106,0.4)', borderRadius: 6, padding: '5px 10px', color: 'rgba(196,149,106,0.8)', fontSize: 10, cursor: 'pointer', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
      >
        Quitter
      </button>
    </div>
  )
}