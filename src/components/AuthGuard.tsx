'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading } = useSupabaseAuth()
  const router = useRouter()
  const [forceShow, setForceShow] = useState(false)

  // Sécurité absolue : si après 5s on est toujours en loading, on force l'affichage
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 5000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // Encore en chargement ET pas de forceShow → spinner
  if (loading && !forceShow) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#C4956A', marginBottom: 8 }}>Novae</div>
          <div style={{ fontSize: 14, color: '#6B6B6B' }}>Chargement...</div>
          <div style={{ marginTop: 16, width: 40, height: 4, background: '#E8E4DF', borderRadius: 4, overflow: 'hidden', margin: '16px auto 0' }}>
            <div style={{ width: '60%', height: '100%', background: '#C4956A', borderRadius: 4, animation: 'slide 1.2s ease-in-out infinite' }} />
          </div>
          <style>{`@keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }`}</style>
        </div>
      </div>
    )
  }

  if (!user) {
    return fallback || null
  }

  return <>{children}</>
}