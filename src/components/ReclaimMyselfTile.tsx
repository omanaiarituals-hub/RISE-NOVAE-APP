'use client'

import Link from 'next/link'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

// ⚠️ Doit correspondre à la liste dans AdminTile.tsx — TOUT EN MINUSCULES
// Tuile temporaire de TEST INTERNE : a retirer (ou a transformer en tuile
// visible pour toutes) une fois le module Parcours Profonds valide et
// pret pour le deploiement global.
const TESTER_EMAILS = ['nesserinesediri@gmail.com']

/**
 * Tuile « Reclaim Myself » — visible UNIQUEMENT pour les emails dans TESTER_EMAILS.
 * Pour toutes les autres utilisatrices : retourne null.
 *
 * Utilise le hook useSupabaseAuth (cohérent avec le reste de l'app).
 * Pointe vers /parcours-profonds/reclaim-myself.
 */
export default function ReclaimMyselfTile() {
  const { user } = useSupabaseAuth()

  if (!user?.email) return null
  if (!TESTER_EMAILS.includes(user.email.toLowerCase())) return null

  return (
    <Link href="/parcours-profonds/reclaim-myself" style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(191,214,190,0.55), rgba(169,199,166,0.4))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(143,174,142,0.45)',
          borderRadius: 16,
          padding: '13px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          boxShadow: '0 4px 12px rgba(61,92,74,0.1)',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 7,
            right: 8,
            fontSize: 7.5,
            color: '#5C7A66',
            background: 'rgba(255,255,255,0.6)',
            borderRadius: 999,
            padding: '2px 6px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Test
        </span>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            background: 'linear-gradient(135deg, #B8D2B5, #8FAE8E)',
            flexShrink: 0,
          }}
        >
          🌿
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: '#2F4D38',
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Reclaim Myself
          </div>
          <div
            style={{
              fontSize: 9,
              color: '#4D7257',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 2,
              fontWeight: 600,
            }}
          >
            Parcours profond
          </div>
        </div>
      </div>
    </Link>
  )
}