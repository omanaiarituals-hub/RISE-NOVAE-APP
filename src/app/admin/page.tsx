'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

const ADMIN_EMAIL = 'nesserinesediri@gmail.com'

interface Challenge {
  id: string
  title: string
  description: string
  emoji: string
  starts_at: string
  ends_at: string
  is_active: boolean
  participants_count?: number
  completed_count?: number
}

interface Post {
  id: string
  user_id: string
  content: string
  likes_count: number
  comments_count: number
  created_at: string
  pseudo?: string
}

interface Stats {
  total_users: number
  total_posts: number
  total_challenges: number
  total_participations: number
  active_this_week: number
}

export default function AdminPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'stats' | 'challenges' | 'posts'>('stats')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ total_users: 0, total_posts: 0, total_challenges: 0, total_participations: 0, active_this_week: 0 })
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [posts, setPosts] = useState<Post[]>([])

  // Formulaire défi
  const [showForm, setShowForm] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    emoji: '🎯',
    starts_at: '',
    ends_at: '',
    is_active: true
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

useEffect(() => {
  if (authLoading) return
  if (!user) { router.push('/auth'); return }
  if (user.email !== ADMIN_EMAIL) { router.push('/'); return }
  loadAll()
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [user, authLoading])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadStats(), loadChallenges(), loadPosts()])
    setLoading(false)
  }

  const loadStats = async () => {
    const [usersRes, postsRes, challengesRes, participationsRes] = await Promise.all([
      supabase.from('ai_personality_profile').select('*', { count: 'exact', head: true }),
      supabase.from('community_posts').select('*', { count: 'exact', head: true }),
      supabase.from('community_challenges').select('*', { count: 'exact', head: true }),
      supabase.from('challenge_participations').select('*', { count: 'exact', head: true }),
    ])

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: activeCount } = await supabase
      .from('community_posts')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    setStats({
      total_users: usersRes.count || 0,
      total_posts: postsRes.count || 0,
      total_challenges: challengesRes.count || 0,
      total_participations: participationsRes.count || 0,
      active_this_week: activeCount || 0,
    })
  }

  const loadChallenges = async () => {
    const { data } = await supabase
      .from('community_challenges')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data) return

    const enriched = await Promise.all(data.map(async (c) => {
      const { count: total } = await supabase
        .from('challenge_participations')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', c.id)
      const { count: completed } = await supabase
        .from('challenge_participations')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', c.id)
        .eq('completed', true)
      return { ...c, participants_count: total || 0, completed_count: completed || 0 }
    }))

    setChallenges(enriched)
  }

  const loadPosts = async () => {
    const { data } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) return

    const userIds = Array.from(new Set(data.map(p => p.user_id)))
    const { data: profiles } = await supabase
      .from('ai_personality_profile')
      .select('user_id, pseudo')
      .in('user_id', userIds)

    const pseudoMap: Record<string, string> = {}
    profiles?.forEach(p => { pseudoMap[p.user_id] = p.pseudo })

    setPosts(data.map(p => ({
      ...p,
      pseudo: pseudoMap[p.user_id] || p.user_id.slice(0, 8)
    })))
  }

  const openForm = (challenge?: Challenge) => {
    if (challenge) {
      setEditingChallenge(challenge)
      setFormData({
        title: challenge.title,
        description: challenge.description || '',
        emoji: challenge.emoji || '🎯',
        starts_at: challenge.starts_at.slice(0, 16),
        ends_at: challenge.ends_at.slice(0, 16),
        is_active: challenge.is_active
      })
    } else {
      setEditingChallenge(null)
      const now = new Date()
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      setFormData({
        title: '',
        description: '',
        emoji: '🎯',
        starts_at: now.toISOString().slice(0, 16),
        ends_at: nextWeek.toISOString().slice(0, 16),
        is_active: true
      })
    }
    setShowForm(true)
  }

  const saveChallenge = async () => {
    if (!formData.title || !formData.starts_at || !formData.ends_at) return
    setSaving(true)
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        emoji: formData.emoji,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: new Date(formData.ends_at).toISOString(),
        is_active: formData.is_active
      }

      if (editingChallenge) {
        await supabase.from('community_challenges').update(payload).eq('id', editingChallenge.id)
      } else {
        await supabase.from('community_challenges').insert(payload)
      }

      setShowForm(false)
      loadChallenges()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (challenge: Challenge) => {
    await supabase.from('community_challenges')
      .update({ is_active: !challenge.is_active })
      .eq('id', challenge.id)
    setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, is_active: !c.is_active } : c))
  }

  const deleteChallenge = async (id: string) => {
    await supabase.from('community_challenges').delete().eq('id', id)
    setChallenges(prev => prev.filter(c => c.id !== id))
    setConfirmDelete(null)
  }

  const deletePost = async (id: string) => {
    await supabase.from('community_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#C4956A', fontFamily: 'serif', fontSize: 18 }}>Chargement admin...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', fontFamily: "'DM Sans', sans-serif", color: '#FFFFFF' }}>

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid rgba(196,149,106,0.2)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#C4956A', fontWeight: 600 }}>NOVAÉ</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{user?.email}</span>
          <button onClick={loadAll} style={{ background: 'rgba(196,149,106,0.1)', border: '1px solid rgba(196,149,106,0.3)', borderRadius: 8, padding: '6px 12px', color: '#C4956A', fontSize: 12, cursor: 'pointer' }}>
            🔄 Actualiser
          </button>
          <button onClick={() => router.push('/')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
            ← App
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[
            { id: 'stats', label: '📊 Stats', },
            { id: 'challenges', label: '🎯 Défis', },
            { id: 'posts', label: '💬 Posts', },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: activeTab === tab.id ? '#C4956A' : 'rgba(255,255,255,0.05)', color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── STATS ── */}
        {activeTab === 'stats' && (
          <div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C4956A', marginBottom: 20 }}>Vue d'ensemble</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Utilisatrices', value: stats.total_users, emoji: '👥', color: '#C4956A' },
                { label: 'Posts communauté', value: stats.total_posts, emoji: '💬', color: '#7B6FA0' },
                { label: 'Défis créés', value: stats.total_challenges, emoji: '🎯', color: '#4CAF50' },
                { label: 'Participations', value: stats.total_participations, emoji: '⚡', color: '#FF9800' },
                { label: 'Actives cette semaine', value: stats.active_this_week, emoji: '🔥', color: '#F44336' },
              ].map((stat, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 18px' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.emoji}</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 600, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(196,149,106,0.08)', border: '1px solid rgba(196,149,106,0.2)', borderRadius: 16, padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, color: '#C4956A', fontWeight: 600, margin: '0 0 12px' }}>Actions rapides</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setActiveTab('challenges'); openForm() }}
                  style={{ padding: '10px 18px', background: '#C4956A', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Créer un défi
                </button>
                <button onClick={() => setActiveTab('posts')}
                  style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>
                  Modérer les posts
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DÉFIS ── */}
        {activeTab === 'challenges' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C4956A', margin: 0 }}>Défis communauté</h2>
              <button onClick={() => openForm()}
                style={{ padding: '10px 20px', background: '#C4956A', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Nouveau défi
              </button>
            </div>

            {challenges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
                <p>Aucun défi créé. Lance le premier !</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {challenges.map(challenge => (
                  <div key={challenge.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${challenge.is_active ? 'rgba(196,149,106,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <span style={{ fontSize: 32, flexShrink: 0 }}>{challenge.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#FFFFFF' }}>{challenge.title}</h3>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: challenge.is_active ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)', color: challenge.is_active ? '#4CAF50' : 'rgba(255,255,255,0.3)', border: `1px solid ${challenge.is_active ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.1)'}`, fontWeight: 600 }}>
                            {challenge.is_active ? '● Actif' : '○ Inactif'}
                          </span>
                        </div>
                        {challenge.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{challenge.description}</p>}
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                          <span>📅 {formatDate(challenge.starts_at)} → {formatDate(challenge.ends_at)}</span>
                          <span>👥 {challenge.participants_count} participantes</span>
                          <span>✅ {challenge.completed_count} complétés</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => toggleActive(challenge)}
                          style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
                          {challenge.is_active ? 'Désactiver' : 'Activer'}
                        </button>
                        <button onClick={() => openForm(challenge)}
                          style={{ padding: '6px 12px', background: 'rgba(196,149,106,0.1)', border: '1px solid rgba(196,149,106,0.2)', borderRadius: 8, color: '#C4956A', fontSize: 12, cursor: 'pointer' }}>
                          ✏️ Modifier
                        </button>
                        <button onClick={() => setConfirmDelete(challenge.id)}
                          style={{ padding: '6px 12px', background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.2)', borderRadius: 8, color: '#DC5050', fontSize: 12, cursor: 'pointer' }}>
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Confirmation suppression défi */}
                    {confirmDelete === challenge.id && (
                      <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: '#DC5050', flex: 1 }}>Confirmer la suppression de ce défi ?</span>
                        <button onClick={() => deleteChallenge(challenge.id)}
                          style={{ padding: '6px 14px', background: '#DC5050', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Supprimer
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── POSTS ── */}
        {activeTab === 'posts' && (
          <div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C4956A', marginBottom: 20 }}>Modération des posts</h2>
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <p>Aucun post dans la communauté.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {posts.map(post => (
                  <div key={post.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(196,149,106,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C4956A', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {post.pseudo?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#C4956A' }}>{post.pseudo}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{formatDateTime(post.created_at)}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>💛 {post.likes_count} · 💬 {post.comments_count}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{post.content}</p>
                      </div>
                      <button onClick={() => setConfirmDelete('post_' + post.id)}
                        style={{ padding: '6px 10px', background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.2)', borderRadius: 8, color: '#DC5050', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                        🗑️
                      </button>
                    </div>
                    {confirmDelete === 'post_' + post.id && (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: '#DC5050', flex: 1 }}>Supprimer ce post ?</span>
                        <button onClick={() => deletePost(post.id)}
                          style={{ padding: '5px 12px', background: '#DC5050', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Supprimer
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL FORMULAIRE DÉFI ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1E1E1E', border: '1px solid rgba(196,149,106,0.3)', borderRadius: 20, maxWidth: 520, width: '100%', padding: '32px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: '#C4956A', margin: '0 0 24px' }}>
              {editingChallenge ? '✏️ Modifier le défi' : '+ Nouveau défi'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: '0 0 80px' }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Emoji</label>
                  <input value={formData.emoji} onChange={e => setFormData(p => ({ ...p, emoji: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px', fontSize: 24, textAlign: 'center', outline: 'none', color: 'white', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Titre *</label>
                  <input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                    placeholder="Ex: 5 jours de routine matin"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', color: 'white', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const }}
                    onFocus={e => e.target.style.borderColor = '#C4956A'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Description</label>
                <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Décris le défi en détail..."
                  rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', color: 'white', fontFamily: "'DM Sans', sans-serif", resize: 'vertical', boxSizing: 'border-box' as const }}
                  onFocus={e => e.target.style.borderColor = '#C4956A'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Début *</label>
                  <input type="datetime-local" value={formData.starts_at} onChange={e => setFormData(p => ({ ...p, starts_at: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', color: 'white', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const, colorScheme: 'dark' }}
                    onFocus={e => e.target.style.borderColor = '#C4956A'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fin *</label>
                  <input type="datetime-local" value={formData.ends_at} onChange={e => setFormData(p => ({ ...p, ends_at: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', color: 'white', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const, colorScheme: 'dark' }}
                    onFocus={e => e.target.style.borderColor = '#C4956A'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#C4956A' }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Défi actif (visible dans la communauté)</span>
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={saveChallenge} disabled={saving || !formData.title}
                  style={{ flex: 1, padding: '12px', background: formData.title ? '#C4956A' : 'rgba(196,149,106,0.3)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: formData.title ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif" }}>
                  {saving ? 'Enregistrement...' : editingChallenge ? '✓ Mettre à jour' : '✓ Créer le défi'}
                </button>
                <button onClick={() => setShowForm(false)}
                  style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}