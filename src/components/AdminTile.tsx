'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

// ⚠️ Doit correspondre à la liste dans app/admin/page.tsx
const ADMIN_EMAILS = ['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com']

/**
 * Tuile « Admin » — visible UNIQUEMENT pour les emails dans ADMIN_EMAILS.
 * Pour toutes les autres utilisatrices : retourne null (rien dans le DOM).
 *
 * Conçue pour s'intégrer dans la grille MODULES_GRID de la home :
 * même structure (Link > div avec icône + titre), mêmes dimensions,
 * mais teinte foncée copper/brown pour la distinguer comme tuile admin.
 */
export default function AdminTile() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        setIsAdmin(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  if (!isAdmin) return null

  return (
    <Link href="/admin" style={{ textDecoration: 'none' }}>
      <div
        style={{
          background:
            'linear-gradient(135deg, rgba(61, 38, 24, 0.88), rgba(107, 83, 64, 0.78))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(196, 149, 106, 0.45)',
          borderRadius: 16,
          padding: '13px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          boxShadow: '0 4px 12px rgba(61, 38, 24, 0.16)',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            background: 'linear-gradient(135deg, #c4956a, #8b5a3c)',
            flexShrink: 0,
          }}
        >
          🛡️
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: '#f3dcc6',
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Admin
          </div>
          <div
            style={{
              fontSize: 9,
              color: '#d4a574',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 2,
              fontWeight: 600,
            }}
          >
            Pilotage
          </div>
        </div>
      </div>
    </Link>
  )
}