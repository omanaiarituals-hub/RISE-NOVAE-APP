'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DEMO_MODULES = [
  { id: 'programme', icon: '🎯', label: 'Programme 90j', color: '#F5EDE8', href: '/program' },
  { id: 'planner', icon: '📅', label: 'Planner', color: '#E8EEF5', href: '/planner' },
  { id: 'defis', icon: '⚡', label: 'Défis', color: '#F0E8F5', href: '/defis' },
  { id: 'tracker', icon: '📊', label: 'Tracker', color: '#E8F5EC', href: '/tracker' },
  { id: 'routines', icon: '☀️', label: 'Routines', color: '#FFF5E8', href: '/routines' },
  { id: 'agent', icon: '🤖', label: 'Agent IA', color: '#F5E8E8', href: '/agent' },
  { id: 'recettes', icon: '🛒', label: 'Recettes', color: '#E8F5F0', href: '/recipes' },
  { id: 'famille', icon: '💛', label: 'Famille', color: '#FFF5E8', href: '/family' },
  { id: 'notes', icon: '📝', label: 'Notes', color: '#F5F0E8', href: '/notes' },
  { id: 'communaute', icon: '👥', label: 'Communauté', color: '#EEE8F5', href: '/community' },
]

export default function DemoAppPage() {
  const router = useRouter()
  const [showConvert, setShowConvert] = useState(false)
  const [email, setEmail] = useState('')
  const [prenom, setPrenom] = useState('')
  const [mode, setMode] = useState<'choice' | 'beta' | 'waitlist' | 'done'>('choice')
  const [sending, setSending] = useState(false)

  // ── Flag démo : les vraies pages lisent ce flag pour afficher "← Accueil démo"
  useEffect(() => {
    localStorage.setItem('novae-demo-mode', 'true')
    localStorage.setItem('novae-demo-back', '/demo/app')
  }, [])

  const handleModuleClick = () => {
    localStorage.setItem('novae-demo-mode', 'true')
    localStorage.setItem('novae-demo-back', '/demo/app')
  }

  const API_URL = 'https://novae-by-omanaia.com/api/subscribe'

  const submit = async (listId: number, source: string) => {
    if (!email) return
    setSending(true)
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, prenom, listId, SOURCE: source })
      })
    } catch(e) {}
    finally {
      setSending(false)
      setMode('done')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif" }}>

      {/* BANNIÈRE DÉMO FIXE */}
      <div style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2A1F15 100%)', padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 100 }}>
        <span style={{ fontSize: 11, color: '#C4956A', fontWeight: 700, letterSpacing: '0.15em', flexShrink: 0 }}>MODE DÉMO</span>
        <span style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Explore librement · Aucune donnée enregistrée</span>
        <button onClick={() => setShowConvert(true)} style={{ background: '#C4956A', border: 'none', borderRadius: 6, padding: '6px 12px', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
          Rejoindre ✦
        </button>
      </div>

      {/* HEADER */}
      <div style={{ background: 'white', padding: '14px 20px', borderBottom: '1px solid rgba(196,149,106,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#C4956A', letterSpacing: '0.08em' }}>Novae</div>
          <div style={{ fontSize: 10, color: 'rgba(26,26,26,0.35)', marginTop: 1 }}>Jour 1 / 90</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#6B6560' }}>Mode Démo</div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(196,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
        </div>
      </div>

      {/* CONTENU HOME */}
      <div style={{ padding: '20px', maxWidth: 500, margin: '0 auto' }}>

        {/* Salutation */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#6B6560', marginBottom: 4 }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 500, color: '#1A1A1A', margin: 0 }}>
            Bonjour 👋
          </h1>
          <p style={{ fontSize: 13, color: '#6B6560', fontStyle: 'italic', marginTop: 4 }}>
            Bienvenue dans ton espace de transformation.
          </p>
        </div>

        {/* Carte programme */}
        <div style={{ background: '#1A1A1A', borderRadius: 20, padding: '20px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, background: 'radial-gradient(circle, rgba(196,149,106,0.15) 0%, transparent 70%)' }} />
          <div style={{ fontSize: 10, color: 'rgba(196,149,106,0.8)', fontWeight: 700, letterSpacing: '0.2em', marginBottom: 8 }}>PHASE 1 — REPROGRAMMATION</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 400, color: '#C4956A', lineHeight: 1 }}>1 <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>/90</span></div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, margin: '12px 0', overflow: 'hidden' }}>
            <div style={{ width: '1%', height: '100%', background: '#C4956A', borderRadius: 2 }} />
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>Tu construis les fondations. Chaque petit geste compte.</p>
          <Link href="/program/1" onClick={handleModuleClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C4956A', color: 'white', padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            🎯 Voir ma mission du jour →
          </Link>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { icon: '📋', value: '0/0', label: 'tâches' },
            { icon: '☀️', value: '0/5', label: 'routines' },
            { icon: '🤖', value: 'Agent', label: 'NOVAÉ' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, padding: '14px 10px', textAlign: 'center', border: '1px solid rgba(196,149,106,0.1)' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#6B6560' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Grille modules */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.3)', marginBottom: 12 }}>Tous les modules</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {DEMO_MODULES.map(m => (
            <Link key={m.id} href={m.href} onClick={handleModuleClick} style={{ background: m.color, borderRadius: 14, padding: '16px 12px', textAlign: 'center', textDecoration: 'none', display: 'block', border: '1px solid rgba(196,149,106,0.08)', transition: 'transform 0.2s' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.2 }}>{m.label}</div>
            </Link>
          ))}
        </div>

        {/* CTA conversion */}
        <div style={{ background: 'white', borderRadius: 20, padding: '20px', border: '1px solid rgba(196,149,106,0.15)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>✦</div>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#1A1A1A', marginBottom: 8 }}>Tu aimes ce que tu vois ?</h3>
          <p style={{ fontSize: 12, color: '#6B6560', lineHeight: 1.7, marginBottom: 16 }}>Rejoins la bêta pour un accès complet et gratuit pendant toute la phase de test.</p>
          <button onClick={() => setShowConvert(true)} style={{ width: '100%', padding: '14px', background: '#1A1A1A', border: 'none', borderRadius: 12, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
            ✦ Rejoindre la bêta gratuitement
          </button>
          <button onClick={() => { setMode('waitlist'); setShowConvert(true) }} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #E8E0D8', borderRadius: 12, color: '#6B6560', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            📩 Liste d'attente
          </button>
        </div>
      </div>

      {/* POPUP CONVERSION */}
      {showConvert && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowConvert(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}>
          <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 500, padding: '32px 24px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: 40, height: 4, background: '#E8E0D8', borderRadius: 2, margin: '0 auto 24px' }} />

            {mode === 'done' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#1A1A1A', marginBottom: 8 }}>C'est noté !</h3>
                <p style={{ fontSize: 13, color: '#6B6560', lineHeight: 1.7 }}>Merci {prenom || ''} ! Tu seras parmi les premières informées.<br/>— Ness, fondatrice d'OMANAÏA</p>
                <button onClick={() => setShowConvert(false)} style={{ marginTop: 20, padding: '12px 24px', background: '#1A1A1A', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Continuer à explorer →
                </button>
              </div>
            ) : mode === 'choice' ? (
              <div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#1A1A1A', marginBottom: 6 }}>Rejoindre NOVAÉ</h3>
                <p style={{ fontSize: 13, color: '#6B6560', marginBottom: 20 }}>Comment veux-tu continuer l'aventure ?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button onClick={() => setMode('beta')} style={{ padding: '16px', background: '#1A1A1A', border: 'none', borderRadius: 12, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif" }}>
                    <span style={{ fontSize: 22 }}>✦</span>
                    <div>
                      <div style={{ marginBottom: 2 }}>Bêta testrice</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Accès gratuit + badge Fondatrice + tarif préférentiel</div>
                    </div>
                  </button>
                  <button onClick={() => setMode('waitlist')} style={{ padding: '16px', background: '#FAF7F2', border: '1.5px solid #E8E0D8', borderRadius: 12, color: '#1A1A1A', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif" }}>
                    <span style={{ fontSize: 22 }}>📩</span>
                    <div>
                      <div style={{ marginBottom: 2 }}>Liste d'attente</div>
                      <div style={{ fontSize: 11, color: '#6B6560', fontWeight: 400 }}>Être alertée au lancement + offre exclusive -20%</div>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button onClick={() => setMode('choice')} style={{ background: 'none', border: 'none', color: '#6B6560', fontSize: 12, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Retour</button>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#1A1A1A', marginBottom: 20 }}>
                  {mode === 'beta' ? 'Rejoindre la bêta ✦' : 'Liste d\'attente'}
                </h3>
                <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Ton prénom"
                  style={{ width: '100%', padding: '12px', border: '1.5px solid #E8E0D8', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", background: '#FAF7F2', marginBottom: 10, boxSizing: 'border-box' as const }} />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Ton email *" type="email"
                  style={{ width: '100%', padding: '12px', border: '1.5px solid #E8E0D8', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", background: '#FAF7F2', marginBottom: 16, boxSizing: 'border-box' as const }} />
                <button onClick={() => submit(mode === 'beta' ? 7 : 8, mode === 'beta' ? 'beta_testeur_demo' : 'liste_attente_demo')}
                  disabled={!email || sending}
                  style={{ width: '100%', padding: '14px', background: email ? '#C4956A' : 'rgba(26,26,26,0.08)', border: 'none', borderRadius: 10, color: email ? 'white' : 'rgba(26,26,26,0.3)', fontSize: 13, fontWeight: 600, cursor: email ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif" }}>
                  {sending ? 'Envoi...' : mode === 'beta' ? 'Envoyer ma candidature ✦' : 'M\'inscrire →'}
                </button>
                <p style={{ fontSize: 10, color: '#6B6560', textAlign: 'center', marginTop: 8 }}>🔒 Données confidentielles · Jamais vendues</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  )
}