'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import Link from 'next/link'
import { ArrowLeft, User, Shield, Bell, Trash2, LogOut, ChevronRight, Check, Loader2 } from 'lucide-react'

const C = {
  cream: '#FAF7F2', rose: '#C4956A', roseLight: 'rgba(196,149,106,0.1)',
  violet: '#7B6FA0', violetLight: 'rgba(123,111,160,0.1)',
  noir: '#2C2C2C', gris: '#6B6B6B', grisClair: '#E8E4DF', blanc: '#FFFFFF',
}

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

function Row({ icon, label, value, onClick, danger, last }: { icon: React.ReactNode; label: string; value?: string; onClick?: () => void; danger?: boolean; last?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', background: 'none', border: 'none',
        borderBottom: last ? 'none' : `1px solid ${C.grisClair}`,
        cursor: onClick ? 'pointer' : 'default', textAlign: 'left',
      }}>
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

  useEffect(() => {
    const keys = ['notif_routines', 'notif_conflits', 'notif_anniversaires', 'notif_inactivite', 'notif_bilan']
    const state: Record<string, boolean> = {}
    keys.forEach(k => { state[k] = localStorage.getItem(k) !== 'false' })
    setNotifState(state)
  }, [])

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUser(user)
    const p = user.user_metadata?.pseudo || user.user_metadata?.full_name || ''
    setPseudo(p)
    setNewPseudo(p)
  }

  const savePseudo = async () => {
    if (!newPseudo.trim() || !user) return
    setSaving(true)
    try {
      // 1. Sauvegarde dans auth metadata
      await supabase.auth.updateUser({ data: { pseudo: newPseudo.trim() } })

      // 2. Sauvegarde dans ai_personality_profile (utilisé par la communauté)
      await supabase
        .from('ai_personality_profile')
        .update({ pseudo: newPseudo.trim() })
        .eq('user_id', user.id)

      setPseudo(newPseudo.trim())
      setEditingPseudo(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Erreur savePseudo:', err)
    }
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
      if (u) {
        await supabase.from('routines').delete().eq('user_id', u.id)
        await supabase.from('tasks').delete().eq('user_id', u.id)
        await supabase.from('todo_list').delete().eq('user_id', u.id)
        await supabase.from('program_progress').delete().eq('user_id', u.id)
        await supabase.from('meal_plan').delete().eq('user_id', u.id)
        await supabase.from('community_posts').delete().eq('user_id', u.id)
        await supabase.from('community_likes').delete().eq('user_id', u.id)
        await supabase.from('community_comments').delete().eq('user_id', u.id)
        await supabase.from('challenge_participations').delete().eq('user_id', u.id)
        await supabase.from('user_badges').delete().eq('user_id', u.id)
      }
      await supabase.auth.signOut()
      router.push('/auth')
    } catch (err) {
      console.error(err)
    }
    setDeleting(false)
  }

  const initials = pseudo ? pseudo.slice(0, 2).toUpperCase() : user?.email?.slice(0, 2).toUpperCase() || 'NS'

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
      <Navigation />
      <div className="md:ml-64 pb-24 md:pb-8">
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

          {/* Header */}
          <header style={{ marginBottom: 28 }}>
            <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: C.gris, background: 'rgba(44,44,44,0.05)', border: 'none', borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}>
              <ArrowLeft size={13} /> Accueil
            </button>
            <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.noir }}>Paramètres</h1>
          </header>

          {/* Avatar + nom */}
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

          {/* Profil */}
          <Section title="Mon profil">
            {editingPseudo ? (
              <div style={{ padding: '14px 16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: C.gris }}>Choisis ton pseudo affiché dans l'app et dans la communauté</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newPseudo} onChange={e => setNewPseudo(e.target.value)} placeholder="Ton pseudo..."
                    autoFocus maxLength={30}
                    style={{ flex: 1, border: `1.5px solid ${C.rose}`, borderRadius: 10, padding: '8px 12px', fontSize: 14, outline: 'none', color: C.noir, background: C.cream, fontFamily: "'DM Sans',sans-serif" }} />
                  <button onClick={savePseudo} disabled={saving || !newPseudo.trim()}
                    style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: C.rose, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {saving ? <Loader2 size={14} /> : saved ? <Check size={14} /> : '✓'}
                  </button>
                  <button onClick={() => { setEditingPseudo(false); setNewPseudo(pseudo) }}
                    style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.grisClair}`, background: 'white', fontSize: 13, cursor: 'pointer', color: C.gris }}>
                    ×
                  </button>
                </div>
              </div>
            ) : (
              <Row icon={<User size={16} />} label="Pseudo" value={pseudo || 'Non défini — clique pour définir'} onClick={() => setEditingPseudo(true)} />
            )}
            <Row icon={<span style={{ fontSize: 16 }}>✉️</span>} label="Email" value={user?.email} last />
          </Section>

          {/* Notifications */}
          <Section title="Notifications">
            {[
              { key: 'notif_routines', label: 'Rappels routines', desc: 'Rappel matin et soir' },
              { key: 'notif_conflits', label: 'Conflits de planning', desc: 'Quand un conflit est détecté' },
              { key: 'notif_anniversaires', label: 'Anniversaires famille', desc: 'Alerte J-7' },
              { key: 'notif_inactivite', label: 'Rappel inactivité', desc: 'Si pas de connexion 48h' },
              { key: 'notif_bilan', label: 'Bilan hebdomadaire', desc: 'Chaque dimanche matin' },
            ].map((notif, i, arr) => (
              <div key={notif.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${C.grisClair}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: C.roseLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.rose, flexShrink: 0 }}>
                  🔔
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.noir }}>{notif.label}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: C.gris }}>{notif.desc}</p>
                </div>
                <button
                  onClick={() => {
                    const current = localStorage.getItem(notif.key) !== 'false'
                    localStorage.setItem(notif.key, current ? 'false' : 'true')
                    setNotifState(prev => ({ ...prev, [notif.key]: !current }))
                  }}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: notifState[notif.key] !== false ? C.rose : C.grisClair,
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', left: notifState[notif.key] !== false ? 22 : 2,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                  }} />
                </button>
              </div>
            ))}
          </Section>

          {/* Légal */}
          <Section title="Informations légales">
            <Row icon={<Shield size={16} />} label="Conditions d'utilisation" onClick={() => router.push('/cgu')} />
            <Row icon={<span style={{ fontSize: 16 }}>🔒</span>} label="Politique de confidentialité" onClick={() => router.push('/confidentialite')} last />
          </Section>

          {/* App */}
          <Section title="Application">
            <Row icon={<span style={{ fontSize: 16 }}>⭐</span>} label="Version" value={`${appVersion} — Bêta gratuite`} />
            <Row icon={<span style={{ fontSize: 16 }}>📧</span>} label="Nous contacter" value="contact@omanaia.com" last />
          </Section>

          {/* Compte */}
          <Section title="Mon compte">
            <Row icon={<LogOut size={16} />} label="Se déconnecter" onClick={handleSignOut} />
            <Row icon={<Trash2 size={16} />} label="Supprimer mon compte" danger onClick={() => setShowDeleteConfirm(true)} last />
          </Section>

          <p style={{ textAlign: 'center', fontSize: 11, color: C.gris, opacity: 0.4, marginTop: 8 }}>
            RISE NOVAÉ · Novaé by OMANAÏA · v{appVersion}
          </p>

        </main>
      </div>

      {/* Modal suppression compte */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: C.blanc, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 500, padding: '24px 20px 40px' }}>
            <div style={{ width: 40, height: 4, background: C.grisClair, borderRadius: 4, margin: '0 auto 20px' }} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 40 }}>⚠️</span>
              <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir, margin: '10px 0 6px' }}>Supprimer mon compte</h3>
              <p style={{ fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                Cette action est <strong>irréversible</strong>. Toutes tes données seront définitivement supprimées.
              </p>
            </div>
            <p style={{ fontSize: 12, color: C.gris, marginBottom: 8 }}>Tape <strong>SUPPRIMER</strong> pour confirmer</p>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="SUPPRIMER"
              style={{ width: '100%', border: `1.5px solid rgba(220,80,80,0.3)`, borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', color: C.noir, background: '#FFF5F5', boxSizing: 'border-box' as const, marginBottom: 12, fontFamily: "'DM Sans',sans-serif" }} />
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