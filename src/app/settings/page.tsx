'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import { ArrowLeft, User, Shield, Trash2, LogOut, ChevronRight, Check, Loader2 } from 'lucide-react'

const C = {
  cream: '#FAF7F2', rose: '#C4956A', roseLight: 'rgba(196,149,106,0.1)',
  violet: '#7B6FA0', violetLight: 'rgba(123,111,160,0.1)',
  noir: '#2C2C2C', gris: '#6B6B6B', grisClair: '#E8E4DF', blanc: '#FFFFFF',
}

const NOTIF_ITEMS = [
  { key: 'notif_routines',     label: 'Rappels routines',       desc: 'À l\'heure de chaque rituel planifié' },
  { key: 'notif_conflits',     label: 'Événements & RDV',       desc: '15 min avant chaque événement du planning' },
  { key: 'notif_communaute',   label: 'Messages communauté',    desc: 'Nouveaux posts dans la communauté' },
  { key: 'notif_anniversaires',label: 'Anniversaires famille',  desc: 'Alerte J-7 avant chaque anniversaire' },
  { key: 'notif_inactivite',   label: 'Rappel inactivité',      desc: 'Si pas de connexion depuis 48h' },
  { key: 'notif_bilan',        label: 'Bilan hebdomadaire',     desc: 'Chaque dimanche matin' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: C.gris, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px', paddingLeft: 4 }}>{title}</p>
      <div style={{ background: C.blanc, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(44,44,44,0.05)' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ icon, label, value, onClick, danger, last }: {
  icon: React.ReactNode; label: string; value?: string
  onClick?: () => void; danger?: boolean; last?: boolean
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'none', border: 'none', borderBottom: last ? 'none' : `1px solid ${C.grisClair}`, cursor: onClick ? 'pointer' : 'default', textAlign: 'left' }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: danger ? 'rgba(220,80,80,0.1)' : C.roseLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: danger ? '#DC5050' : C.rose, flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: danger ? '#DC5050' : C.noir }}>{label}</p>
        {value && <p style={{ margin: '1px 0 0', fontSize: 12, color: C.gris }}>{value}</p>}
      </div>
      {onClick && <ChevronRight size={16} style={{ color: C.grisClair }} />}
    </button>
  )
}

// Helper VAPID base64 -> Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [pseudo, setPseudo] = useState('')
  const [editingPseudo, setEditingPseudo] = useState(false)
  const [newPseudo, setNewPseudo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [appVersion] = useState('1.0.0-beta')
  const [notifState, setNotifState] = useState<Record<string, boolean>>({})
  const [notifPermission, setNotifPermission] = useState<string>('default')
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(false)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission)
    }
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUser(user)
    const p = user.user_metadata?.pseudo || user.user_metadata?.full_name || ''
    setPseudo(p)
    setNewPseudo(p)

    // Charger les preferences depuis Supabase
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (subs) {
      setHasSubscription(true)
      const state: Record<string, boolean> = {}
      NOTIF_ITEMS.forEach(n => {
        state[n.key] = subs[n.key] !== false
      })
      setNotifState(state)
    } else {
      // Par defaut tous activés
      const state: Record<string, boolean> = {}
      NOTIF_ITEMS.forEach(n => { state[n.key] = true })
      setNotifState(state)
    }
  }

  // ── Sync preferences vers Supabase ────────────────────────────────────────
  const syncPreferences = async (prefs: Record<string, boolean>) => {
    try {
      const res = await fetch('/api/push/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('[Settings] Erreur sync prefs:', err)
        return
      }
      console.log('[Settings] Preferences sauvegardees:', prefs)
    } catch (err) {
      console.error('[Settings] Exception sync prefs:', err)
    }
  }

  // ── Subscribe Web Push ────────────────────────────────────────────────────
  const subscribeToPush = async (): Promise<boolean> => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.error('[Settings] Push non supporte par ce navigateur')
        return false
      }

      const registration = await navigator.serviceWorker.ready

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('[Settings] VAPID public key manquante')
        return false
      }

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
      }

      const subJson = subscription.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('[Settings] Erreur subscribe:', err)
        return false
      }

      setHasSubscription(true)
      console.log('[Settings] Souscription enregistree')
      return true
    } catch (err) {
      console.error('[Settings] Exception subscribe:', err)
      return false
    }
  }

  // ── Toggle notif ──────────────────────────────────────────────────────────
  const toggleNotif = async (key: string) => {
    const current = notifState[key] !== false
    const newValue = !current

    // Si on active et pas de permission → demander
    if (newValue && notifPermission !== 'granted') {
      await requestNotifPermission()
      return
    }

    // Si on active et pas encore de souscription → souscrire
    if (newValue && !hasSubscription) {
      const ok = await subscribeToPush()
      if (!ok) return
    }

    const newState = { ...notifState, [key]: newValue }
    setNotifState(newState)
    await syncPreferences(newState)
  }

  // ── Demander permission ───────────────────────────────────────────────────
  const requestNotifPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    setRequestingPermission(true)
    try {
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)
      if (permission === 'granted') {
        const ok = await subscribeToPush()
        if (ok) {
          // Activer toutes les notifs par defaut
          const allEnabled: Record<string, boolean> = {}
          NOTIF_ITEMS.forEach(n => { allEnabled[n.key] = true })
          setNotifState(allEnabled)
          await syncPreferences(allEnabled)
        }
      }
    } finally {
      setRequestingPermission(false)
    }
  }

  // ── Pseudo ────────────────────────────────────────────────────────────────
  const savePseudo = async () => {
    if (!newPseudo.trim() || !user) return
    setSaving(true)
    try {
      await supabase.auth.updateUser({ data: { pseudo: newPseudo.trim() } })
      await supabase.from('ai_personality_profile').update({ pseudo: newPseudo.trim() }).eq('user_id', user.id)
      setPseudo(newPseudo.trim())
      setEditingPseudo(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'SUPPRIMER') return
    setDeleting(true)
    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) return
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id }),
      })
      if (res.ok) { await supabase.auth.signOut(); router.push('/auth') }
    } catch (err) { console.error(err) }
    setDeleting(false)
  }

  const initials = pseudo ? pseudo.slice(0, 2).toUpperCase() : user?.email?.slice(0, 2).toUpperCase() || 'NS'

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
      <Navigation />
      <div className="md:ml-64 pb-24 md:pb-8">
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

          <header style={{ marginBottom: 28 }}>
            <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: C.gris, background: 'rgba(44,44,44,0.05)', border: 'none', borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}>
              <ArrowLeft size={13} /> Accueil
            </button>
            <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.noir }}>Paramètres</h1>
          </header>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: C.blanc, borderRadius: 20, padding: '18px 20px', marginBottom: 24, boxShadow: '0 2px 12px rgba(44,44,44,0.05)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${C.rose}, ${C.violet})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.noir, fontFamily: "'Cormorant Garamond',serif" }}>{pseudo || 'Novaé'}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.gris }}>{user?.email}</p>
            </div>
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(144,200,168,0.15)', color: '#2A6A48', border: '1px solid rgba(144,200,168,0.3)', fontWeight: 600 }}>Bêta gratuit</span>
          </div>

          <Section title="Mon profil">
            {editingPseudo ? (
              <div style={{ padding: '14px 16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: C.gris }}>Pseudo affiché dans l'app et la communauté</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newPseudo} onChange={e => setNewPseudo(e.target.value)} placeholder="Ton pseudo..." autoFocus maxLength={30}
                    style={{ flex: 1, border: `1.5px solid ${C.rose}`, borderRadius: 10, padding: '8px 12px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream, fontFamily: "'DM Sans',sans-serif" }} />
                  <button onClick={savePseudo} disabled={saving || !newPseudo.trim()}
                    style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: C.rose, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {saving ? <Loader2 size={14} /> : saved ? <Check size={14} /> : '✓'}
                  </button>
                  <button onClick={() => { setEditingPseudo(false); setNewPseudo(pseudo) }}
                    style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 13, cursor: 'pointer', color: C.gris }}>×</button>
                </div>
              </div>
            ) : (
              <Row icon={<User size={16} />} label="Pseudo" value={pseudo || 'Non défini — clique pour définir'} onClick={() => setEditingPseudo(true)} />
            )}
            <Row icon={<span style={{ fontSize: 16 }}>✉️</span>} label="Email" value={user?.email} last />
          </Section>

          <Section title="Notifications">
            {notifPermission === 'denied' && (
              <div style={{ padding: '12px 16px', background: 'rgba(220,80,80,0.06)', borderBottom: `1px solid ${C.grisClair}` }}>
                <p style={{ margin: 0, fontSize: 12, color: '#DC5050', fontWeight: 600 }}>⚠️ Notifications bloquées dans ton navigateur</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: C.gris }}>
                  Va dans les paramètres de ton navigateur → Site → Autoriser les notifications pour app.novae-by-omanaia.com
                </p>
              </div>
            )}

            {notifPermission === 'default' && (
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.grisClair}` }}>
                <button onClick={requestNotifPermission} disabled={requestingPermission}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: C.rose, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {requestingPermission ? <Loader2 size={14} /> : '🔔'}
                  {requestingPermission ? 'Activation...' : 'Activer les notifications push'}
                </button>
              </div>
            )}

            {notifPermission === 'granted' && (
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.grisClair}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>✅</span>
                <p style={{ margin: 0, fontSize: 12, color: '#2A6A48', fontWeight: 600 }}>Notifications push activées</p>
              </div>
            )}

            {NOTIF_ITEMS.map((notif, i) => (
              <div key={notif.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i === NOTIF_ITEMS.length - 1 ? 'none' : `1px solid ${C.grisClair}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: C.roseLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.rose, flexShrink: 0, fontSize: 16 }}>🔔</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.noir }}>{notif.label}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: C.gris }}>{notif.desc}</p>
                </div>
                <button onClick={() => toggleNotif(notif.key)} disabled={notifPermission === 'denied'}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none',
                    cursor: notifPermission === 'denied' ? 'not-allowed' : 'pointer',
                    background: notifState[notif.key] !== false && notifPermission === 'granted' ? C.rose : C.grisClair,
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    opacity: notifPermission === 'denied' ? 0.5 : 1,
                  }}>
                  <span style={{
                    position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                    left: notifState[notif.key] !== false && notifPermission === 'granted' ? 22 : 2,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>
            ))}
          </Section>

          <Section title="Informations légales">
            <Row icon={<Shield size={16} />} label="Conditions d'utilisation" onClick={() => router.push('/cgu')} />
            <Row icon={<span style={{ fontSize: 16 }}>🔒</span>} label="Politique de confidentialité" onClick={() => router.push('/confidentialite')} last />
          </Section>

          <Section title="Application">
            <Row icon={<span style={{ fontSize: 16 }}>⭐</span>} label="Version" value={`${appVersion} — Bêta gratuite`} />
            <Row icon={<span style={{ fontSize: 16 }}>📧</span>} label="Nous contacter" value="contact@omanaia.com" last />
          </Section>

          <Section title="Mon compte">
            <Row icon={<LogOut size={16} />} label="Se déconnecter" onClick={handleSignOut} />
            <Row icon={<Trash2 size={16} />} label="Supprimer mon compte" danger onClick={() => setShowDeleteConfirm(true)} last />
          </Section>

          <p style={{ textAlign: 'center', fontSize: 11, color: C.gris, opacity: 0.4, marginTop: 8 }}>
            RISE NOVAÉ · Novaé by OMANAÏA · v{appVersion}
          </p>

        </main>
      </div>

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 500, padding: '24px 20px 40px' }}>
            <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 40 }}>⚠️</span>
              <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir, margin: '10px 0 6px' }}>Supprimer mon compte</h3>
              <p style={{ fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                Cette action est <strong>irréversible</strong>. Toutes tes données seront supprimées.
              </p>
            </div>
            <p style={{ fontSize: 12, color: C.gris, marginBottom: 8 }}>Tape <strong>SUPPRIMER</strong> pour confirmer</p>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="SUPPRIMER"
              style={{ width: '100%', border: '1.5px solid rgba(220,80,80,0.3)', borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', color: C.noir, background: '#FFF5F5', boxSizing: 'border-box' as const, marginBottom: 12, fontFamily: "'DM Sans',sans-serif" }} />
            <button onClick={handleDeleteAccount} disabled={deleteInput !== 'SUPPRIMER' || deleting}
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: deleteInput === 'SUPPRIMER' ? '#DC5050' : C.grisClair, color: deleteInput === 'SUPPRIMER' ? 'white' : '#aaa', fontSize: 14, fontWeight: 700, cursor: deleteInput === 'SUPPRIMER' ? 'pointer' : 'not-allowed', marginBottom: 8 }}>
              {deleting ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
              style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 14, color: C.gris, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}