'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuccessPage() {
  const router = useRouter()

  useEffect(() => {
    setTimeout(() => router.push('/'), 5000)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0a0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: 24,
    }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>✦</div>
      <h1 style={{ color: '#C4956A', fontFamily: 'serif', fontSize: 40, marginBottom: 16 }}>
        Bienvenue dans NOVAÉ
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginBottom: 8 }}>
        Ton abonnement est activé. L'aventure commence maintenant.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        Redirection automatique dans 5 secondes...
      </p>
      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: 32,
          padding: '14px 32px',
          background: '#C4956A',
          color: '#3A0D1C',
          border: 'none',
          borderRadius: 4,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Accéder à l'app →
      </button>
    </div>
  )
}