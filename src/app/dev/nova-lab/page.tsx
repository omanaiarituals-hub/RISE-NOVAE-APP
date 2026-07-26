'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import NovaLabClient from './NovaLabClient'

export default function NovaLabPage() {
  const { user, loading } = useSupabaseAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth')
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#F7F5F1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 30,
              color: '#8B6F55',
              marginBottom: 8,
            }}
          >
            Nova V2
          </div>

          <p style={{ color: '#6B6B6B', fontSize: 14 }}>
            Vérification de la session…
          </p>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return <NovaLabClient userEmail={user.email || ''} />
}
