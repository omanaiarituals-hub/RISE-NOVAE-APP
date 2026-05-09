'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

const C = {
  cream: '#f3dcc6',
  brown: '#3d2618',
  brownLight: '#6b5340',
  brownMid: '#8b6f55',
  copper: '#c4956a',
  copperLight: '#d4a574',
  copperDark: '#8b5a3c',
}

interface NotifPrefs {
  notif_routines: boolean
  notif_conflits: boolean
  notif_communaute: boolean
  notif_anniversaires: boolean
  notif_inactivite: boolean
  notif_bilan: boolean
}

interface UserPrefs {
  routine_morning_time: string
  routine_evening_time: string
}

const NOTIF_CATEGORIES: Array<{ key: keyof NotifPrefs; emoji: string; label: string; desc: string }> = [
  { key: 'notif_routines', emoji: '☀️', label: 'Routines & briefs', desc: 'Brief matin et soir, rituels' },
  { key: 'notif_conflits', emoji: '📅', label: 'Planning & conflits', desc: 'Rappels d\'événements, conflits d\'agenda' },
  { key: 'notif_communaute', emoji: '💬', label: 'Communauté', desc: 'Réponses à tes posts, résumé du jour' },
  { key: 'notif_anniversaires', emoji: '🎂', label: 'Anniversaires', desc: 'Rappels J-7 et le jour J pour ta famille' },
  { key: 'notif_inactivite', emoji: '🌸', label: 'Inactivité', desc: 'Messages doux quand tu ne reviens pas' },
  { key: 'notif_bilan', emoji: '✦', label: 'Bilan hebdo', desc: 'Ton débrief du dimanche par l\'IA' },
]

export default function SettingsPage() {
  const { user, loading: authLoading } = useSupabaseAuth()

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    notif_routines: true, notif_conflits: true, notif_communaute: true,
    notif_anniversaires: true, notif_inactivite: true, notif_bilan: true,
  })
  const [userPrefs, setUserPrefs] = useState<UserPrefs>({
    routine_morning_time: '07:30',
    routine_evening_time: '21:00',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (user && !authLoading) loadPrefs()
  }, [user, authLoading])

  const loadPrefs = async () => {
    if (!user) return
    setLoading(true)

    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('notif_routines, notif_conflits, notif_communaute, notif_anniversaires, notif_inactivite, notif_bilan')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (sub) {
      setNotifPrefs({
        notif_routines: sub.notif_routines ?? true,
        notif_conflits: sub.notif_conflits ?? true,
        notif_communaute: sub.notif_communaute ?? true,
        notif_anniversaires: sub.notif_anniversaires ?? true,
        notif_inactivite: sub.notif_inactivite ?? true,
        notif_bilan: sub.notif_bilan ?? true,
      })
    }

    const { data: u } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()

    if (u?.preferences) {
      setUserPrefs({
        routine_morning_time: u.preferences.routine_morning_time || '07:30',
        routine_evening_time: u.preferences.routine_evening_time || '21:00',
      })
    }

    setLoading(false)
  }

  const toggleNotif = (key: keyof NotifPrefs) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const saveAll = async () => {
    if (!user) return
    setSaving(true)
    try {
      await fetch('/api/push/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifPrefs),
      })
      await fetch('/api/user/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPrefs),
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } catch (err) {
      console.error('[Settings] Erreur:', err)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3dcc6' }}>
        <p style={{ color: C.brownLight, fontFamily: "'DM Sans', sans-serif" }}>Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3dcc6', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: C.brown, fontFamily: "'DM Sans', sans-serif" }}>Tu dois être connectée</p>
        <Link href="/auth" style={{ color: C.copperDark, fontWeight: 600 }}>Se connecter</Link>
      </div>
    )
  }

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background:
          'radial-gradient(ellipse at 20% 0%, #e8c4a8 0%, transparent 55%),' +
          'radial-gradient(ellipse at 80% 100%, #d4a574 0%, transparent 55%),' +
          'linear-gradient(180deg, #f3dcc6 0%, #ead0b5 50%, #e0c4a3 100%)',
      }} />

      <div style={{
        minHeight: '100vh',
        fontFamily: "'DM Sans', sans-serif",
        position: 'relative', zIndex: 2, paddingBottom: 100,
      }}>
        <div style={{ padding: '18px 20px 12px', maxWidth: 600, margin: '0 auto' }}>
          <Link href="/" style={{
            fontSize: 12, color: C.brownLight, textDecoration: 'none',
            padding: '6px 12px', borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.5)',
            border: '1px solid rgba(212, 165, 116, 0.3)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'inline-block', marginBottom: 12,
          }}>← Accueil</Link>

          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 36, fontWeight: 400, color: C.brown,
            margin: 0, letterSpacing: '0.5px',
          }}>Paramètres</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.brownLight, fontStyle: 'italic' }}>
            Tes notifications, à ta façon ✦
          </p>
        </div>

        <main style={{ maxWidth: 600, margin: '0 auto', padding: '12px 20px 40px' }}>
          {/* SECTION ROUTINES */}
          <div style={glassCard}>
            <h2 style={sectionTitle}>Mes heures de routines</h2>
            <p style={sectionDesc}>
              Définis l'heure à laquelle tu veux recevoir tes rappels rituels (sauvegardé pour toi, application progressive selon ton plan d'hébergement).
            </p>

            <div style={{ display: 'grid', gap: 14 }}>
              <TimeInput
                label="☀️ Routine matin"
                value={userPrefs.routine_morning_time}
                onChange={v => setUserPrefs(p => ({ ...p, routine_morning_time: v }))}
              />
              <TimeInput
                label="🌙 Routine soir"
                value={userPrefs.routine_evening_time}
                onChange={v => setUserPrefs(p => ({ ...p, routine_evening_time: v }))}
              />
            </div>
          </div>

          {/* SECTION NOTIFS */}
          <div style={glassCard}>
            <h2 style={sectionTitle}>Notifications</h2>
            <p style={sectionDesc}>Choisis ce que tu veux recevoir.</p>

            <div style={{ display: 'grid', gap: 12 }}>
              {NOTIF_CATEGORIES.map(cat => (
                <div key={cat.key} style={notifRow}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.brown }}>
                      {cat.label}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.brownLight, lineHeight: 1.3 }}>
                      {cat.desc}
                    </p>
                  </div>
                  <Toggle checked={notifPrefs[cat.key]} onChange={() => toggleNotif(cat.key)} />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={saveAll}
            disabled={saving}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 16, border: 'none',
              background: savedFlash
                ? 'linear-gradient(135deg, #90c8a8, #6ab089)'
                : 'linear-gradient(135deg, #c4956a, #8b5a3c)',
              color: 'white', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(139, 90, 60, 0.2)',
              transition: 'background 0.3s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {savedFlash ? '✓ Préférences enregistrées' : saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </main>
      </div>
    </>
  )
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: '#6b5340', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 6,
      }}>{label}</label>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', fontSize: 15,
          fontFamily: 'inherit', color: '#3d2618',
          background: 'rgba(255, 255, 255, 0.55)',
          border: '1px solid rgba(212, 165, 116, 0.3)',
          borderRadius: 12, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      style={{
        width: 48, height: 28, borderRadius: 14, border: 'none',
        background: checked
          ? 'linear-gradient(135deg, #c4956a, #8b5a3c)'
          : 'rgba(139, 90, 60, 0.18)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 22, height: 22, borderRadius: '50%',
        background: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

const glassCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 20, padding: 22, marginBottom: 16,
  boxShadow: '0 4px 16px rgba(139, 90, 60, 0.06)',
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 20, color: '#3d2618',
  margin: '0 0 4px', fontWeight: 500,
}

const sectionDesc: React.CSSProperties = {
  fontSize: 12, color: '#6b5340',
  margin: '0 0 18px', opacity: 0.85,
}

const notifRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 14px',
  background: 'rgba(255, 255, 255, 0.4)',
  border: '1px solid rgba(212, 165, 116, 0.18)',
  borderRadius: 14,
}