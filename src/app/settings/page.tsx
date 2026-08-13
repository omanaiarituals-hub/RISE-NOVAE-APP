'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import CancelSubscription from '@/components/CancelSubscription'

const C = {
  cream: 'var(--novae-background, #f3dcc6)',
  surface: 'var(--novae-surface, #ffffff)',
  surfaceAlt: 'var(--novae-surface-alt, #fff9f5)',
  brown: 'var(--novae-text-main, #3d2618)',
  brownLight: 'var(--novae-text-muted, #6b5340)',
  brownMid: 'var(--novae-secondary, #8b6f55)',
  copper: 'var(--novae-accent, #c4956a)',
  copperLight: 'var(--novae-primary-soft, #d4a574)',
  copperDark: 'var(--novae-primary, #8b5a3c)',
  border: 'var(--novae-border, var(--novae-border, rgba(212, 165, 116, 0.3)))',
}

interface NotifPrefs {
  notif_morning_brief: boolean
  notif_evening_prepare: boolean
  notif_weekly_review: boolean
  notif_planner_reminders: boolean
  notif_anniversaires: boolean
}

interface UserPrefs {
  notification_morning_time: string
  notification_evening_time: string
  notification_weekly_day: number
  notification_weekly_time: string
  timezone: string
}

type NotifCategory = {
  key: keyof NotifPrefs
  emoji: string
  label: string
  desc: string
  schedule?: 'morning' | 'evening' | 'weekly'
}

const NOTIF_CATEGORIES: NotifCategory[] = [
  { key: 'notif_planner_reminders', emoji: '📅', label: 'Rappels de mon planning', desc: "Le rappel choisi sur chaque événement ou tâche." },
  { key: 'notif_morning_brief', emoji: '☀️', label: 'Mon programme du jour', desc: 'Planning et tâches utiles pour démarrer la journée.', schedule: 'morning' },
  { key: 'notif_evening_prepare', emoji: '🌙', label: 'Anticiper demain', desc: "Seulement quand quelque chose mérite d'être préparé pour demain.", schedule: 'evening' },
  { key: 'notif_weekly_review', emoji: '✦', label: 'Bilan de ma semaine', desc: 'Tâches terminées, tâches restantes et invitation à les replacer avec Nova.', schedule: 'weekly' },
  { key: 'notif_anniversaires', emoji: '🎂', label: 'Anniversaires', desc: 'Rappels J-7 et le jour J pour ta famille.' },
]

const WEEK_DAYS = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
]

export default function SettingsPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    notif_morning_brief: true,
    notif_evening_prepare: true,
    notif_weekly_review: true,
    notif_planner_reminders: true,
    notif_anniversaires: true,
  })
  const [userPrefs, setUserPrefs] = useState<UserPrefs>({
    notification_morning_time: '07:00',
    notification_evening_time: '19:00',
    notification_weekly_day: 0,
    notification_weekly_time: '18:00',
    timezone: 'Europe/Paris',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Suppression de compte
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [showMemoryResetModal, setShowMemoryResetModal] = useState(false)
  const [memoryResetConfirmText, setMemoryResetConfirmText] = useState('')
  const [resettingMemory, setResettingMemory] = useState(false)
  const [memoryResetError, setMemoryResetError] = useState('')
  const [memoryResetDone, setMemoryResetDone] = useState(false)

  useEffect(() => {
    if (user && !authLoading) loadPrefs()
  }, [user, authLoading])

  const loadPrefs = async () => {
    if (!user) return
    setLoading(true)

    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('notif_morning_brief, notif_evening_prepare, notif_weekly_review, notif_planner_reminders, notif_anniversaires')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (sub) {
      setNotifPrefs({
        notif_morning_brief: sub.notif_morning_brief ?? true,
        notif_evening_prepare: sub.notif_evening_prepare ?? true,
        notif_weekly_review: sub.notif_weekly_review ?? true,
        notif_planner_reminders: sub.notif_planner_reminders ?? true,
        notif_anniversaires: sub.notif_anniversaires ?? true,
      })
    }

    const { data: u } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'
    const prefs = (u?.preferences || {}) as Record<string, unknown>
    setUserPrefs({
      notification_morning_time: String(prefs.notification_morning_time || prefs.routine_morning_time || '07:00'),
      notification_evening_time: String(prefs.notification_evening_time || prefs.routine_evening_time || '19:00'),
      notification_weekly_day: Number.isInteger(prefs.notification_weekly_day)
        ? Number(prefs.notification_weekly_day)
        : 0,
      notification_weekly_time: String(prefs.notification_weekly_time || '18:00'),
      timezone: String(prefs.timezone || browserTimezone || 'Europe/Paris'),
    })

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

  const handleResetNovaMemory = async () => {
    if (memoryResetConfirmText !== 'OUBLIER') return
    setResettingMemory(true)
    setMemoryResetError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setMemoryResetError('Ta session a expiré. Reconnecte-toi.')
        setResettingMemory(false)
        return
      }
      const response = await fetch('/api/nova/memory/reset', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) {
        setMemoryResetError(data.error || 'Erreur lors de la réinitialisation')
        setResettingMemory(false)
        return
      }
      setResettingMemory(false)
      setMemoryResetDone(true)
      setShowMemoryResetModal(false)
    } catch (err) {
      console.error('[Settings] Erreur reset mémoire Nova:', err)
      setMemoryResetError('Erreur de connexion. Réessaie.')
      setResettingMemory(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return
    setDeleting(true)
    setDeleteError('')

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        setDeleteError(data.error || 'Erreur lors de la suppression')
        setDeleting(false)
        return
      }

      // Logout local et redirection
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('[Settings] Erreur suppression:', err)
      setDeleteError('Erreur de connexion. Réessaie.')
      setDeleting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.cream }}>
        <p style={{ color: C.brownLight, fontFamily: "'DM Sans', sans-serif" }}>Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.cream, flexDirection: 'column', gap: 12 }}>
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
          'radial-gradient(ellipse at 20% 0%, var(--novae-primary-soft, #e8c4a8) 0%, transparent 55%),' +
          'radial-gradient(ellipse at 80% 100%, var(--novae-accent, #d4a574) 0%, transparent 55%),' +
          'linear-gradient(180deg, var(--novae-background, #f3dcc6) 0%, var(--novae-surface-alt, #ead0b5) 50%, var(--novae-primary-soft, #e0c4a3) 100%)',
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
            border: '1px solid var(--novae-border, rgba(212, 165, 116, 0.3))',
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
{/* SECTION PERSONNALISATION */}
          <Link
            href="/personnalisation"
            style={{
              ...glassCard,
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                background: 'linear-gradient(135deg, var(--novae-accent, #c4956a), var(--novae-primary, #8b5a3c))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 20,
                flexShrink: 0,
                boxShadow: '0 4px 12px var(--novae-primary-soft, rgba(139, 90, 60, 0.18))',
              }}>
                ✦
              </div>

              <div style={{ flex: 1 }}>
                <h2 style={sectionTitle}>Personnalisation de Nova</h2>
                <p style={sectionDesc}>
                  Adapte le ton de Nova, tes priorités, tes rappels, les couleurs, la typographie et l’ambiance de ton application.
                </p>

                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.copperDark,
                }}>
                  Ouvrir la personnalisation →
                </span>
              </div>
            </div>
          </Link>

          {/* SECTION NOTIFS */}
          <div style={glassCard}>
            <h2 style={sectionTitle}>Notifications</h2>
            <p style={sectionDesc}>Choisis ce que tu veux recevoir.</p>

            <div style={{ display: 'grid', gap: 12 }}>
              {NOTIF_CATEGORIES.map(cat => (
                <div key={cat.key} style={{
                  borderRadius: 16,
                  border: '1px solid var(--novae-border, rgba(212, 165, 116, 0.22))',
                  background: 'rgba(255,255,255,0.38)',
                  overflow: 'hidden',
                }}>
                  <div style={{ ...notifRow, border: 'none', background: 'transparent' }}>
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

                  {notifPrefs[cat.key] && cat.schedule === 'morning' && (
                    <div style={{ padding: '0 14px 14px 52px' }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.brownLight }}>Heure du brief</label>
                      <input
                        type="time"
                        value={userPrefs.notification_morning_time}
                        onChange={e => setUserPrefs(prev => ({ ...prev, notification_morning_time: e.target.value }))}
                        style={timeInputStyle}
                      />
                    </div>
                  )}

                  {notifPrefs[cat.key] && cat.schedule === 'evening' && (
                    <div style={{ padding: '0 14px 14px 52px' }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.brownLight }}>Heure pour préparer demain</label>
                      <input
                        type="time"
                        value={userPrefs.notification_evening_time}
                        onChange={e => setUserPrefs(prev => ({ ...prev, notification_evening_time: e.target.value }))}
                        style={timeInputStyle}
                      />
                    </div>
                  )}

                  {notifPrefs[cat.key] && cat.schedule === 'weekly' && (
                    <div style={{ padding: '0 14px 14px 52px', display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: C.brownLight }}>Jour</label>
                        <select
                          value={userPrefs.notification_weekly_day}
                          onChange={e => setUserPrefs(prev => ({ ...prev, notification_weekly_day: Number(e.target.value) }))}
                          style={timeInputStyle}
                        >
                          {WEEK_DAYS.map(day => (
                            <option key={day.value} value={day.value}>{day.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: C.brownLight }}>Heure</label>
                        <input
                          type="time"
                          value={userPrefs.notification_weekly_time}
                          onChange={e => setUserPrefs(prev => ({ ...prev, notification_weekly_time: e.target.value }))}
                          style={timeInputStyle}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p style={{ margin: '12px 2px 0', fontSize: 10, lineHeight: 1.45, color: C.brownLight }}>
              Les heures suivent ton fuseau local ({userPrefs.timezone}). Les rappels d'événements gardent toujours le délai choisi sur chaque événement.
            </p>
          </div>

          <button
            onClick={saveAll}
            disabled={saving}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 16, border: 'none',
              background: savedFlash
                ? 'linear-gradient(135deg, #90c8a8, #6ab089)'
                : 'linear-gradient(135deg, var(--novae-accent, #c4956a), var(--novae-primary, #8b5a3c))',
              color: '#FFFFFF', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(55, 35, 25, 0.16)',
              transition: 'background 0.3s',
              opacity: saving ? 0.7 : 1,
              marginBottom: 32,
            }}
          >
            {savedFlash ? '✓ Préférences enregistrées' : saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          {/* MON ABONNEMENT */}
          <CancelSubscription />
          
          {/* ZONE SENSIBLE UNIFIÉE */}
          <section
            id="zone-sensible"
            aria-labelledby="sensitive-zone-title"
            style={{
              background: 'rgba(255, 240, 240, 0.64)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(180, 80, 80, 0.28)',
              borderRadius: 20,
              padding: 22,
              boxShadow: '0 4px 16px rgba(180, 80, 80, 0.06)',
            }}
          >
            <h2
              id="sensitive-zone-title"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22,
                color: '#8b3a3a',
                margin: '0 0 4px',
                fontWeight: 600,
              }}
            >
              Zone sensible
            </h2>
            <p style={{
              fontSize: 12,
              color: '#6b4040',
              margin: '0 0 18px',
              lineHeight: 1.5,
              opacity: 0.9,
            }}>
              Ces actions ont des conséquences importantes. NOVAÉ te demandera toujours une confirmation explicite avant d’exécuter quoi que ce soit.
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{
                padding: 16,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.58)',
                border: '1px solid rgba(180, 80, 80, 0.18)',
              }}>
                <h3 style={{ margin: 0, fontSize: 14, color: C.brown, fontWeight: 800 }}>
                  Mémoire de Nova
                </h3>
                <p style={{
                  margin: '6px 0 12px',
                  fontSize: 12,
                  color: C.brownLight,
                  lineHeight: 1.5,
                }}>
                  Efface ce que Nova a appris et l’historique de tes échanges. Tes documents, ta famille, ton Planner, tes notes, tes recettes et ton compte restent intacts.
                </p>
                {memoryResetDone ? (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.copperDark }}>
                    La mémoire de Nova a été réinitialisée.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMemoryResetError('')
                      setMemoryResetConfirmText('')
                      setShowMemoryResetModal(true)
                    }}
                    style={{
                      minHeight: 44,
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: 12,
                      border: '1px solid rgba(180, 80, 80, 0.34)',
                      background: 'rgba(255,255,255,0.72)',
                      color: '#8b3a3a',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      touchAction: 'manipulation',
                    }}
                  >
                    Réinitialiser la mémoire de Nova
                  </button>
                )}
              </div>

              <div style={{
                padding: 16,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.58)',
                border: '1px solid rgba(180, 80, 80, 0.18)',
              }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#8b3a3a', fontWeight: 800 }}>
                  Supprimer mon compte
                </h3>
                <p style={{
                  margin: '6px 0 12px',
                  fontSize: 12,
                  color: '#6b4040',
                  lineHeight: 1.5,
                }}>
                  La suppression du compte est définitive. Tes données associées seront supprimées selon le processus prévu par NOVAÉ. Si tu as un abonnement actif, sa gestion reste distincte de la suppression du compte.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(true)
                    setDeleteConfirmText('')
                    setDeleteError('')
                  }}
                  style={{
                    minHeight: 44,
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(180, 80, 80, 0.4)',
                    background: 'rgba(255, 255, 255, 0.72)',
                    color: '#8b3a3a',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    touchAction: 'manipulation',
                  }}
                >
                  Supprimer mon compte
                </button>
              </div>
            </div>
          </section>

          {/* INFORMATIONS & LÉGAL */}
          <section
            aria-labelledby="legal-info-title"
            style={{
              marginTop: 26,
              padding: '4px 2px 0',
            }}
          >
            <h2
              id="legal-info-title"
              style={{
                margin: '0 0 10px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.brownMid,
              }}
            >
              Informations & légal
            </h2>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px 14px',
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              <Link href="/cgu" style={legalLinkStyle}>
                Conditions générales
              </Link>
              <Link href="/confidentialite" style={legalLinkStyle}>
                Politique de confidentialité
              </Link>
              <a href="#zone-sensible" style={legalLinkStyle}>
                Données & suppression du compte
              </a>
            </div>

            <p
              style={{
                margin: '10px 0 0',
                fontSize: 10,
                lineHeight: 1.45,
                color: C.brownLight,
                opacity: 0.72,
              }}
            >
              NOVAÉ · Informations relatives à ton compte et à tes données personnelles.
            </p>
          </section>
        </main>
      </div>

      {/* MODALE RÉINITIALISATION MÉMOIRE */}
      {showMemoryResetModal && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding:
              'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
          }}
          onClick={() => !resettingMemory && setShowMemoryResetModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-reset-title"
            aria-describedby="memory-reset-description"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.surface,
              borderRadius: 20,
              padding: 24,
              maxWidth: 420,
              width: '100%',
              maxHeight:
                'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
            }}
          >
            <h3
              id="memory-reset-title"
              style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#8b3a3a' }}
            >
              Réinitialiser la mémoire de Nova ?
            </h3>
            <p
              id="memory-reset-description"
              style={{ margin: '10px 0 0', fontSize: 13, color: C.brownLight, lineHeight: 1.5 }}
            >
              Nova oubliera ce qu’elle a appris et l’historique de vos échanges. Cette action est définitive. Tes documents, ta famille, ton Planner, tes notes, tes recettes et ton compte restent intacts.
            </p>

            <p style={{ fontSize: 13, color: C.brown, margin: '16px 0 8px' }}>
              Pour confirmer, écris <strong>OUBLIER</strong> :
            </p>
            <input
              type="text"
              value={memoryResetConfirmText}
              onChange={(e) => setMemoryResetConfirmText(e.target.value)}
              placeholder="OUBLIER"
              autoComplete="off"
              autoCapitalize="characters"
              disabled={resettingMemory}
              style={{
                width: '100%',
                minHeight: 44,
                padding: '11px 14px',
                fontSize: 14,
                fontFamily: 'inherit',
                color: C.brown,
                background: C.surfaceAlt,
                border: '1px solid rgba(180, 80, 80, 0.3)',
                borderRadius: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {memoryResetError && (
              <p
                role="alert"
                style={{
                  margin: '10px 0 0',
                  fontSize: 12,
                  color: '#8b3a3a',
                  background: 'rgba(180,80,80,0.08)',
                  padding: '10px 12px',
                  borderRadius: 10,
                }}
              >
                {memoryResetError}
              </p>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
              marginTop: 18,
            }}>
              <button
                type="button"
                onClick={() => setShowMemoryResetModal(false)}
                disabled={resettingMemory}
                style={{
                  minHeight: 44,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${C.brownLight}`,
                  background: 'transparent',
                  color: C.brown,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: resettingMemory ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleResetNovaMemory}
                disabled={memoryResetConfirmText !== 'OUBLIER' || resettingMemory}
                style={{
                  minHeight: 44,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: 'none',
                  background:
                    memoryResetConfirmText === 'OUBLIER' && !resettingMemory
                      ? 'linear-gradient(135deg, #c44a4a, #8b3a3a)'
                      : 'rgba(180,80,80,0.2)',
                  color:
                    memoryResetConfirmText === 'OUBLIER' && !resettingMemory
                      ? '#fff'
                      : 'rgba(180,80,80,0.55)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor:
                    memoryResetConfirmText === 'OUBLIER' && !resettingMemory
                      ? 'pointer'
                      : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {resettingMemory ? 'Réinitialisation…' : 'Effacer la mémoire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          role="presentation"
          onClick={() => !deleting && setShowDeleteModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(26, 26, 26, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding:
              'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            onClick={e => e.stopPropagation()}
            style={{
              background: C.surface, borderRadius: 20,
              maxWidth: 420, width: '100%', padding: 24,
              maxHeight:
                'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <h3
              id="delete-account-title"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 26, fontWeight: 600, color: '#8b3a3a',
                margin: '0 0 12px',
              }}
            >
              Supprimer ton compte ?
            </h3>
            <p
              id="delete-account-description"
              style={{ fontSize: 14, color: C.brown, lineHeight: 1.6, margin: '0 0 16px' }}
            >
              Cette action est <strong>irréversible</strong>. Tu vas perdre :
            </p>
            <ul style={{ fontSize: 13, color: C.brownLight, lineHeight: 1.7, margin: '0 0 20px', paddingLeft: 20 }}>
              <li>Toutes tes conversations et la mémoire de Nova</li>
              <li>Tes routines, recettes, repas, planner et notes</li>
              <li>Tes données d’entourage et de personnalisation</li>
              <li>Ton profil et les données rattachées à ton compte</li>
            </ul>
            <p style={{
              fontSize: 12,
              color: '#6b4040',
              lineHeight: 1.5,
              margin: '0 0 16px',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(180,80,80,0.06)',
            }}>
              Important : la suppression du compte et la gestion de l’abonnement sont deux opérations distinctes. NOVAÉ devra toujours te donner un accès clair à la gestion ou l’annulation de ton abonnement.
            </p>
            <p style={{ fontSize: 13, color: C.brown, margin: '0 0 8px' }}>
              Pour confirmer, écris <strong>SUPPRIMER</strong> :
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              disabled={deleting}
              style={{
                width: '100%', minHeight: 44, padding: '12px 14px', fontSize: 14,
                fontFamily: 'inherit', color: C.brown,
                background: C.surfaceAlt,
                border: '1px solid rgba(180, 80, 80, 0.3)',
                borderRadius: 12, outline: 'none', boxSizing: 'border-box',
                marginBottom: 20,
              }}
            />
            {deleteError && (
              <p role="alert" style={{
                fontSize: 12, color: '#8b3a3a',
                background: 'rgba(180, 80, 80, 0.08)',
                padding: '10px 12px', borderRadius: 10,
                margin: '0 0 16px',
              }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: '1px solid #e5e5e5', background: C.surface,
                  color: C.brown, fontSize: 14, fontWeight: 600,
                  cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  background: deleteConfirmText === 'SUPPRIMER' && !deleting
                    ? 'linear-gradient(135deg, #c44a4a, #8b3a3a)'
                    : 'rgba(180, 80, 80, 0.2)',
                  color: deleteConfirmText === 'SUPPRIMER' && !deleting ? C.surface : 'rgba(180, 80, 80, 0.5)',
                  fontSize: 14, fontWeight: 700,
                  cursor: deleteConfirmText === 'SUPPRIMER' && !deleting ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: C.brownLight, textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 6,
      }}>{label}</label>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', fontSize: 15,
          fontFamily: 'inherit', color: C.brown,
          background: 'rgba(255, 255, 255, 0.55)',
          border: '1px solid var(--novae-border, rgba(212, 165, 116, 0.3))',
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
          ? 'linear-gradient(135deg, var(--novae-accent, #c4956a), var(--novae-primary, #8b5a3c))'
          : 'var(--novae-primary-soft, rgba(139, 90, 60, 0.18))',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 22, height: 22, borderRadius: '50%',
        background: '#FFFFFF',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

const timeInputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 5,
  minHeight: 40,
  borderRadius: 12,
  border: '1px solid var(--novae-border, rgba(212, 165, 116, 0.34))',
  background: 'rgba(255,255,255,0.74)',
  color: C.brown,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const glassCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 20, padding: 22, marginBottom: 16,
  boxShadow: '0 4px 16px rgba(55, 35, 25, 0.06)',
}

const legalLinkStyle: React.CSSProperties = {
  color: C.brownLight,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  textDecorationColor: 'rgba(139, 90, 60, 0.28)',
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 20, color: C.brown,
  margin: '0 0 4px', fontWeight: 500,
}

const sectionDesc: React.CSSProperties = {
  fontSize: 12, color: C.brownLight,
  margin: '0 0 18px', opacity: 0.85,
}

const notifRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 14px',
  background: 'color-mix(in srgb, var(--novae-surface, #FFFFFF) 68%, transparent)',
  border: '1px solid var(--novae-border, rgba(212, 165, 116, 0.18))',
  borderRadius: 14,
}