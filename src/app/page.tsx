'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { UserMenu } from '@/components/UserMenu'
import { OnboardingTour } from '@/components/OnboardingTour'

const modules = [
  { href: '/program',   emoji: '🎯', title: 'Programme 90 jours', description: 'Ta transformation en 3 phases',      color: '#F2E0D8', border: '#D4A090' },
  { href: '/planner',   emoji: '📅', title: 'Planner & To-do',    description: 'Organise ton temps et tes tâches',   color: '#C8D8E8', border: '#A0BEDC' },
  { href: '/defis',     emoji: '⚡', title: 'Défis',              description: 'Repousse tes limites chaque jour',   color: '#F0D8F0', border: '#C8A0C8' },
  { href: '/tracker',   emoji: '📊', title: 'Tracker',            description: 'Visualise ta progression',           color: '#CCE8D8', border: '#90C8A8' },
  { href: '/routines',  emoji: '☀️', title: 'Routines',           description: 'Tes rituels quotidiens',             color: '#FBF0CC', border: '#E8D080' },
  { href: '/community', emoji: '👥', title: 'Communauté',         description: 'Entraide et partage',                color: '#F5D0DC', border: '#E0A0B8' },
  { href: '/agent',     emoji: '🤖', title: 'Agent IA',           description: 'Ton coach personnel 24/7',           color: '#E8E4DF', border: '#C8C4BF' },
  { href: '/recipes',   emoji: '🛒', title: 'Recettes & Courses', description: 'Bien manger simplement',             color: '#F2E0D8', border: '#D4A090' },
  { href: '/family',    emoji: '💛', title: 'Famille',            description: 'Espace famille partagé',             color: '#FBF0CC', border: '#E8D080' },
]

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

interface DayReflection {
  morningIntention: string
  morningMood: string | null
  eveningGratitude?: string
  eveningHighlight?: string
}

export default function HomePage() {
  const { user } = useSupabaseAuth()
  const [reflection, setReflection] = useState<DayReflection | null>(null)
  const [routineProgress, setRoutineProgress] = useState<{ morning: number; evening: number } | null>(null)

// Forcer le tuto pour les utilisatrices existantes (one-shot)
useEffect(() => {
  const tourVersion = localStorage.getItem('novae-onboarding-version')
  if (tourVersion !== 'v2') {
    localStorage.removeItem('novae-onboarding-done')
    localStorage.setItem('novae-onboarding-version', 'v2')
  }
}, [])
  useEffect(() => {
    const today = fmtDate(new Date())

    // Charger l'intention du jour
    const saved = localStorage.getItem(`novae-reflection-${today}`)
    if (saved) {
      try { setReflection(JSON.parse(saved)) } catch {}
    }

    // Charger la complétion des routines
    const routineKey = `novae-routine-completed-${today}`
    const routineSaved = localStorage.getItem(routineKey)
    if (routineSaved) {
      try {
        const data = JSON.parse(routineSaved)
        setRoutineProgress({
          morning: data.morning ? 100 : 0,
          evening: data.evening ? 100 : 0,
        })
      } catch {}
    }
  }, [])

  const hasIntention = reflection?.morningIntention && reflection.morningIntention.trim().length > 0
  const hasGratitude = reflection?.eveningGratitude && reflection.eveningGratitude.trim().length > 0
  const hour = new Date().getHours()
const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonne après-midi' : 'Bonsoir'

  return (
    <>
      <OnboardingTour />
      <div style={{ minHeight: "100vh", background: "#FAF7F2", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", background: "#FFFFFF", borderBottom: "1px solid #E8E4DF" }}>
        <div>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: "#D4A090" }}>Novae</span>
          <span style={{ fontSize: 12, color: "#6B6B6B", marginLeft: 10 }}>Votre compagnon de vie</span>
        </div>
        <div>
          {user ? <UserMenu /> : (
            <Link href="/auth" style={{ padding: "8px 20px", borderRadius: 20, border: "1.5px solid #D4A090", background: "#FFFFFF", color: "#D4A090", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              Se connecter
            </Link>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 100px" }}>

        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 700, color: "#1A1A1A", margin: "0 0 4px" }}>
{greeting} {user?.user_metadata?.pseudo || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''} 👋          </h1>
          <p style={{ fontSize: 14, color: "#6B6B6B", margin: 0 }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </header>

        {/* Carte intention du jour */}
        {user && (
          <div style={{ marginBottom: 28 }}>
            {hasIntention ? (
              <div style={{ background: "white", border: "1.5px solid rgba(196,149,106,0.25)", borderRadius: 16, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start", boxShadow: "0 2px 12px rgba(196,149,106,0.08)" }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{reflection?.morningMood || '✨'}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#C4956A", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
                    Mon intention du jour
                  </p>
                  <p style={{ fontSize: 15, color: "#1A1A1A", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", margin: "0 0 10px", lineHeight: 1.5 }}>
                    "{reflection?.morningIntention}"
                  </p>
                  {/* Progression routines */}
                  {routineProgress && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: routineProgress.morning === 100 ? "rgba(123,175,142,0.15)" : "rgba(196,149,106,0.1)", color: routineProgress.morning === 100 ? "#7BAF8E" : "#C4956A", border: `1px solid ${routineProgress.morning === 100 ? "#90C8A8" : "rgba(196,149,106,0.2)"}` }}>
                        ☀️ Matin {routineProgress.morning === 100 ? "✓" : "en cours"}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: routineProgress.evening === 100 ? "rgba(123,175,142,0.15)" : "rgba(123,111,160,0.08)", color: routineProgress.evening === 100 ? "#7BAF8E" : "#7B6FA0", border: `1px solid ${routineProgress.evening === 100 ? "#90C8A8" : "rgba(123,111,160,0.15)"}` }}>
                        🌙 Soir {routineProgress.evening === 100 ? "✓" : "à venir"}
                      </span>
                    </div>
                  )}
                </div>
                <Link href="/routines" style={{ fontSize: 11, color: "#C4956A", textDecoration: "none", flexShrink: 0, opacity: 0.7 }}>
                  Voir →
                </Link>
              </div>
            ) : (
              /* Invitation à définir son intention */
              <Link href="/routines" style={{ textDecoration: "none" }}>
                <div style={{ background: "rgba(196,149,106,0.06)", border: "1.5px dashed rgba(196,149,106,0.3)", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                  <span style={{ fontSize: 24 }}>✨</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#C4956A", margin: "0 0 2px" }}>Définir mon intention du jour</p>
                    <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>Commence ta journée avec clarté et intention</p>
                  </div>
                  <span style={{ marginLeft: "auto", color: "#C4956A", fontSize: 18 }}>→</span>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Module grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {modules.map((mod) => (
            <Link key={mod.href} href={mod.href} style={{ textDecoration: "none" }}>
              <div
                style={{ background: mod.color, border: `1.5px solid ${mod.border}`, borderRadius: 16, padding: "20px 22px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <span style={{ fontSize: 32, flexShrink: 0 }}>{mod.emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, color: "#1A1A1A", marginBottom: 3 }}>{mod.title}</div>
                  <div style={{ fontSize: 12, color: "#6B6B6B" }}>{mod.description}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Paramètres */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50 }}>
        <Link href="/settings" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 20, background: "#FFFFFF", border: "1px solid #E8E4DF", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", textDecoration: "none", fontSize: 12, color: "#6B6B6B" }}>
          ⚙️ Paramètres
        </Link>
      </div>

      {/* Mobile bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #E8E4DF", display: "flex", overflowX: "auto", padding: "8px", gap: 4, zIndex: 40 }} className="md:hidden">
        {modules.map(mod => (
          <Link key={mod.href} href={mod.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 10px", borderRadius: 10, textDecoration: "none", minWidth: 56, flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>{mod.emoji}</span>
            <span style={{ fontSize: 9, color: "#6B6B6B", marginTop: 2 }}>{mod.title.split(" ")[0]}</span>
          </Link>
        ))}
      </div>
      </div>
    </>
  )
}