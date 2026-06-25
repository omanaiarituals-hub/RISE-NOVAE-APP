'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Cette page est une page fantôme sans connexion réelle.
// On redirige immédiatement vers /auth qui est la vraie page de connexion.
export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/auth')
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF7F2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      color: '#8B6F55',
      fontSize: 14,
    }}>
      Redirection...
    </div>
  )
}