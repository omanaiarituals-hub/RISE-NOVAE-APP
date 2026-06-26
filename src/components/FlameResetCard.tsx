// src/components/FlameResetCard.tsx
// Carte fusionnée : flamme à gauche + Reset 90j à droite, sur une seule ligne.
// Remplace le duo côte à côte qui débordait sur mobile.
'use client'

import Link from 'next/link'
import StreakFlame from './StreakFlame'

interface FlameResetCardProps {
  currentDay: number
  programProgress: number
  phase: string
  phaseLabel: string
}

export default function FlameResetCard({ currentDay, programProgress, phase, phaseLabel }: FlameResetCardProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginBottom: 14,
    }}>
      {/* FLAMME */}
      <div style={{
        background: 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.6)',
        borderRadius: 14,
        padding: '10px 12px',
        minWidth: 0,
      }}>
        <StreakFlame />
      </div>

      {/* RESET 90J */}
      <Link href="/program" style={{ textDecoration: 'none', minWidth: 0 }}>
        <div style={{
          height: '100%',
          background: 'rgba(243,205,182,0.35)',
          border: '1px solid rgba(230,180,147,0.45)',
          borderRadius: 14,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 70,
          boxSizing: 'border-box',
        }}>
          <div>
            <div style={{ fontSize: 7.5, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>{phase}</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: '#3d2618', lineHeight: 1.15, marginTop: 2 }}>{phaseLabel}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#3d2618', lineHeight: 1 }}>
                {currentDay > 0 ? currentDay : '—'}
              </span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 11, color: '#a08770' }}>/ 90</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b5a3c', fontWeight: 600 }}>{programProgress}%</span>
            </div>
            <div style={{ height: 3, background: 'rgba(139,90,60,0.15)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${programProgress}%`, background: 'linear-gradient(90deg, #d4a574, #c4956a)', borderRadius: 999 }} />
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}