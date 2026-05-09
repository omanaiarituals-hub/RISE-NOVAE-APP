'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { DemoBanner } from '@/components/DemoBanner'

interface Post {
  id: string
  user_id: string
  content: string
  likes_count: number
  comments_count: number
  created_at: string
  pseudo?: string
  liked_by_me?: boolean
}

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  pseudo?: string
}

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
  my_participation?: { completed: boolean } | null
}

interface Badge {
  id: string
  badge_type: string
  badge_label: string
  earned_at: string
}

const TABS = [
  { id: 'feed', label: 'Fil', icon: '📣' },
  { id: 'challenges', label: 'Défis', icon: '🎯' },
  { id: 'ranking', label: 'Classement', icon: '🏆' },
]

const BADGE_DEFINITIONS: Record<string, { emoji: string; label: string; desc: string }> = {
  first_post:       { emoji: '✍️', label: 'Première voix',          desc: 'Premier post publié' },
  ten_posts:        { emoji: '🌟', label: 'Voix de la communauté',   desc: '10 posts publiés' },
  first_like:       { emoji: '💛', label: 'Bienveillante',           desc: 'Premier like donné' },
  challenge_done:   { emoji: '🎯', label: 'Défi relevé',             desc: 'Défi complété' },
  three_challenges: { emoji: '🔥', label: 'Inépuisable',             desc: '3 défis complétés' },
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 14px',
  background: 'none',
  border: 'none',
  textAlign: 'left',
  fontSize: 13,
  color: '#3d2618',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export default function CommunityPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const [activeTab, setActiveTab] = useState('feed')
  const [posts, setPosts] = useState<Post[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [ranking, setRanking] = useState<any[]>([])
  const [myBadges, setMyBadges] = useState<Badge[]>([])
  const [pseudo, setPseudo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Édition / suppression
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editPostContent, setEditPostContent] = useState('')
  const [postMenuOpen, setPostMenuOpen] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    localStorage.setItem('novae-community-last-visit', new Date().toISOString())
  }, [user])

  useEffect(() => {
    if (user && !authLoading) loadAll()
  }, [user, authLoading])

  // Fermer les menus au clic extérieur
  useEffect(() => {
    if (!postMenuOpen && !commentMenuOpen) return
    const handleClick = () => {
      setPostMenuOpen(null)
      setCommentMenuOpen(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [postMenuOpen, commentMenuOpen])

  const loadAll = async () => {
    if (!user) return
    setLoading(true)
    try {
      await loadPseudo()
      await loadPosts()
      await loadChallenges()
      await loadRanking()
      await loadMyBadges()
    } catch (error) {
      console.error('Erreur loadAll:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPseudo = async () => {
    if (!user) return
    const { data } = await supabase.from('ai_personality_profile').select('pseudo').eq('user_id', user.id).single()
    if (data?.pseudo) setPseudo(data.pseudo)
    else setPseudo(user.email?.split('@')[0] || 'NOVAÉ')
  }

  const loadPosts = async () => {
    if (!user) return
    const { data: postsData } = await supabase
      .from('community_posts').select('*')
      .order('created_at', { ascending: false }).limit(50)
    if (!postsData) return
    const userIds = Array.from(new Set(postsData.map(p => p.user_id)))
    const { data: profiles } = await supabase.from('ai_personality_profile').select('user_id, pseudo').in('user_id', userIds)
    const pseudoMap: Record<string, string> = {}
    profiles?.forEach(p => { if (p.pseudo) pseudoMap[p.user_id] = p.pseudo })
    const { data: myLikes } = await supabase.from('community_likes').select('post_id').eq('user_id', user.id)
    const likedIds = new Set(myLikes?.map(l => l.post_id) || [])
    setPosts(postsData.map(p => ({
      ...p,
      pseudo: pseudoMap[p.user_id] || p.user_id.slice(0, 8),
      liked_by_me: likedIds.has(p.id),
    })))
  }

  const loadChallenges = async () => {
    if (!user) return
    const { data } = await supabase.from('community_challenges').select('*').eq('is_active', true).order('starts_at', { ascending: false })
    if (!data) return
    const enriched = await Promise.all(data.map(async (c) => {
      const { count: total } = await supabase.from('challenge_participations').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id)
      const { count: completed } = await supabase.from('challenge_participations').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id).eq('completed', true)
      const { data: myPart } = await supabase.from('challenge_participations').select('completed').eq('challenge_id', c.id).eq('user_id', user.id).single()
      return { ...c, participants_count: total || 0, completed_count: completed || 0, my_participation: myPart || null }
    }))
    setChallenges(enriched)
  }

  const loadRanking = async () => {
    if (!user) return
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('challenge_participations').select('user_id').eq('completed', true).gte('completed_at', startOfMonth.toISOString())
    if (!data) return
    const counts: Record<string, number> = {}
    data.forEach(p => { counts[p.user_id] = (counts[p.user_id] || 0) + 1 })
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10)
    const userIds = sorted.map(([id]) => id)
    const { data: profiles } = await supabase.from('ai_personality_profile').select('user_id, pseudo').in('user_id', userIds)
    const pseudoMap: Record<string, string> = {}
    profiles?.forEach(p => { pseudoMap[p.user_id] = p.pseudo })
    setRanking(sorted.map(([userId, count], index) => ({
      rank: index + 1, user_id: userId,
      pseudo: pseudoMap[userId] || userId.slice(0, 8),
      count, isMe: userId === user?.id,
    })))
  }

  const loadMyBadges = async () => {
    if (!user) return
    const { data } = await supabase.from('user_badges').select('*').eq('user_id', user.id).order('earned_at', { ascending: false })
    setMyBadges(data || [])
  }

  const loadComments = async (postId: string) => {
    const { data } = await supabase.from('community_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
    if (!data) return
    const userIds = Array.from(new Set(data.map(c => c.user_id)))
    const { data: profiles } = await supabase.from('ai_personality_profile').select('user_id, pseudo').in('user_id', userIds)
    const pseudoMap: Record<string, string> = {}
    profiles?.forEach(p => { pseudoMap[p.user_id] = p.pseudo })
    setComments(prev => ({
      ...prev,
      [postId]: data.map(c => ({ ...c, pseudo: pseudoMap[c.user_id] || c.user_id.slice(0, 8) }))
    }))
  }

  const handlePost = async () => {
    if (!user || !newPost.trim() || posting) return
    setPosting(true)
    try {
      const { data } = await supabase.from('community_posts').insert({ user_id: user.id, content: newPost.trim() }).select().single()
      if (data) {
        setPosts(prev => [{ ...data, pseudo, liked_by_me: false }, ...prev])
        setNewPost('')
        const postCount = posts.filter(p => p.user_id === user.id).length + 1
        if (postCount === 1) await grantBadge('first_post', '✍️ Première voix')
        if (postCount === 10) await grantBadge('ten_posts', '🌟 Voix de la communauté')
      }
    } finally { setPosting(false) }
  }

  // ── Édition / suppression POST ───────────────────────────────────────────
  const startEditPost = (post: Post) => {
    setEditingPost(post.id)
    setEditPostContent(post.content)
    setPostMenuOpen(null)
  }

  const cancelEditPost = () => {
    setEditingPost(null)
    setEditPostContent('')
  }

  const savePost = async (postId: string) => {
    if (!user || !editPostContent.trim()) return
    const { error } = await supabase
      .from('community_posts')
      .update({ content: editPostContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('user_id', user.id)
    if (error) {
      console.error('[community] edit post error:', error)
      return
    }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: editPostContent.trim() } : p))
    cancelEditPost()
  }

  const deletePost = async (postId: string) => {
    if (!user) return
    if (!confirm('Supprimer ce message ? Cette action est irréversible.')) return
    await supabase.from('community_likes').delete().eq('post_id', postId)
    await supabase.from('community_comments').delete().eq('post_id', postId)
    const { error } = await supabase.from('community_posts').delete().eq('id', postId).eq('user_id', user.id)
    if (error) {
      console.error('[community] delete post error:', error)
      return
    }
    setPosts(prev => prev.filter(p => p.id !== postId))
    setComments(prev => { const next = { ...prev }; delete next[postId]; return next })
    setPostMenuOpen(null)
  }

  // ── Édition / suppression COMMENT ────────────────────────────────────────
  const startEditComment = (comment: Comment) => {
    setEditingComment(comment.id)
    setEditCommentContent(comment.content)
    setCommentMenuOpen(null)
  }

  const cancelEditComment = () => {
    setEditingComment(null)
    setEditCommentContent('')
  }

  const saveComment = async (commentId: string, postId: string) => {
    if (!user || !editCommentContent.trim()) return
    const { error } = await supabase
      .from('community_comments')
      .update({ content: editCommentContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', user.id)
    if (error) {
      console.error('[community] edit comment error:', error)
      return
    }
    setComments(prev => ({
      ...prev,
      [postId]: prev[postId].map(c => c.id === commentId ? { ...c, content: editCommentContent.trim() } : c)
    }))
    cancelEditComment()
  }

  const deleteComment = async (commentId: string, postId: string) => {
    if (!user) return
    if (!confirm('Supprimer ce commentaire ?')) return
    const { error } = await supabase
      .from('community_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id)
    if (error) {
      console.error('[community] delete comment error:', error)
      return
    }
    setComments(prev => ({
      ...prev,
      [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
    }))
    const post = posts.find(p => p.id === postId)
    if (post) {
      const newCount = Math.max(0, post.comments_count - 1)
      await supabase.from('community_posts').update({ comments_count: newCount }).eq('id', postId)
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: newCount } : p))
    }
    setCommentMenuOpen(null)
  }

  const handleLike = async (post: Post) => {
    if (!user) return
    if (post.liked_by_me) {
      await supabase.from('community_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      await supabase.from('community_posts').update({ likes_count: Math.max(0, post.likes_count - 1) }).eq('id', post.id)
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked_by_me: false, likes_count: Math.max(0, p.likes_count - 1) } : p))
    } else {
      await supabase.from('community_likes').insert({ post_id: post.id, user_id: user.id })
      await supabase.from('community_posts').update({ likes_count: post.likes_count + 1 }).eq('id', post.id)
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked_by_me: true, likes_count: p.likes_count + 1 } : p))
      const likeCount = posts.filter(p => p.liked_by_me).length
      if (likeCount === 0) await grantBadge('first_like', '💛 Bienveillante')
    }
  }

  const handleComment = async (postId: string) => {
    if (!user || !newComment[postId]?.trim()) return
    const content = newComment[postId].trim()
    setNewComment(prev => ({ ...prev, [postId]: '' }))

    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: postId, user_id: user.id, content })
      .select()
      .single()

    if (error || !data) {
      setNewComment(prev => ({ ...prev, [postId]: content }))
      return
    }

    // Calcul du nouveau compteur sans dépendre de la RPC
    const post = posts.find(p => p.id === postId)
    const newCount = (post?.comments_count || 0) + 1
    await supabase.from('community_posts').update({ comments_count: newCount }).eq('id', postId)

    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), { ...data, pseudo }] }))
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: newCount } : p))

    const targetPost = posts.find(p => p.id === postId)
    if (targetPost && targetPost.user_id !== user.id) {
      try {
        await fetch('/api/notifications/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: targetPost.user_id,
            replierPseudo: pseudo || user.email?.split('@')[0] || 'Quelqu\'un',
            postId,
            postPreview: targetPost.content,
          }),
        })
      } catch (err) { console.error('Reply notif error:', err) }
    }
  }
  
  const handleJoinChallenge = async (challengeId: string) => {
    if (!user) return
    await supabase.from('challenge_participations').insert({ challenge_id: challengeId, user_id: user.id, completed: false })
    setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, my_participation: { completed: false }, participants_count: (c.participants_count || 0) + 1 } : c))
  }

  const handleCompleteChallenge = async (challengeId: string) => {
    if (!user) return
    await supabase.from('challenge_participations').update({ completed: true, completed_at: new Date().toISOString() }).eq('challenge_id', challengeId).eq('user_id', user.id)
    setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, my_participation: { completed: true }, completed_count: (c.completed_count || 0) + 1 } : c))
    const completedCount = challenges.filter(c => c.my_participation?.completed).length + 1
    await grantBadge('challenge_done', '🎯 Défi relevé')
    if (completedCount >= 3) await grantBadge('three_challenges', '🔥 Inépuisable')
    loadRanking()
  }

  const grantBadge = async (type: string, label: string) => {
    if (!user) return
    const exists = myBadges.find(b => b.badge_type === type)
    if (exists) return
    const { data } = await supabase.from('user_badges').insert({ user_id: user.id, badge_type: type, badge_label: label }).select().single()
    if (data) setMyBadges(prev => [data, ...prev])
  }

  const toggleComments = (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null) }
    else { setExpandedPost(postId); if (!comments[postId]) loadComments(postId) }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr); const now = new Date(); const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000); const hours = Math.floor(diff / 3600000); const days = Math.floor(diff / 86400000)
    if (minutes < 1) return "À l'instant"
    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    return `${days}j`
  }

  const formatChallengeDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const getRankEmoji = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  if (authLoading || loading) {
    return (
      <>
        <DemoBanner />
        <div className="flex flex-col h-screen bg-novae-cream items-center justify-center">
          <div className="text-novae-anthracite/40 text-sm">Chargement de la communauté...</div>
        </div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <DemoBanner />
        <div className="flex flex-col h-screen bg-novae-cream items-center justify-center px-6">
          <div className="text-4xl mb-4">👭</div>
          <h2 className="font-serif text-2xl text-novae-anthracite mb-2 text-center">Rejoins la communauté</h2>
          <p className="text-novae-anthracite/50 text-sm text-center mb-6">Connecte-toi pour accéder à l'espace communautaire NOVAÉ.</p>
          <Link href="/auth" className="px-6 py-3 bg-novae-anthracite text-white rounded-xl text-sm font-medium">Se connecter</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <DemoBanner />
      <div className="flex flex-col min-h-screen bg-novae-cream">

        {/* Header */}
        <div className="bg-white border-b border-novae-beige/30 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <Link href="/" className="text-novae-anthracite/50 hover:text-novae-anthracite transition-colors">
            <span className="text-lg">←</span>
          </Link>
          <div className="flex-1">
            <h1 className="font-serif text-lg text-novae-anthracite leading-none">Communauté</h1>
            <p className="text-xs text-novae-anthracite/40 mt-0.5">Bonjour {pseudo} ✦</p>
          </div>
          {myBadges.length > 0 && (
            <div className="flex gap-1">
              {myBadges.slice(0, 3).map(b => (
                <span key={b.id} className="text-lg" title={b.badge_label}>
                  {BADGE_DEFINITIONS[b.badge_type]?.emoji || '🏅'}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-novae-beige/20 px-4 flex gap-1 sticky top-14 z-10">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-novae-gold text-novae-gold' : 'border-transparent text-novae-anthracite/50 hover:text-novae-anthracite'}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4">

          {/* ═══ FEED ═══ */}
          {activeTab === 'feed' && (
            <div className="space-y-4">

              {/* Composer */}
              <div className="bg-white rounded-2xl border border-novae-beige/20 p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {pseudo?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea ref={textareaRef} value={newPost} onChange={e => setNewPost(e.target.value)}
                      placeholder="Partage une victoire, une pensée, une question... ✦"
                      className="w-full text-sm text-novae-anthracite placeholder-novae-anthracite/30 bg-transparent focus:outline-none resize-none"
                      rows={3} maxLength={500} />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-novae-anthracite/20">{newPost.length}/500</span>
                      <button onClick={handlePost} disabled={!newPost.trim() || posting}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${newPost.trim() && !posting ? 'bg-novae-gold text-white' : 'bg-novae-beige/30 text-novae-anthracite/30 cursor-not-allowed'}`}>
                        {posting ? '...' : 'Publier'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Posts */}
              {posts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🌱</div>
                  <p className="text-novae-anthracite/40 text-sm">Sois la première à partager quelque chose !</p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="bg-white rounded-2xl border border-novae-beige/20 shadow-sm overflow-hidden" style={{ position: 'relative' }}>

                    {/* Bulle réponses haut droite */}
                    {post.comments_count > 0 && (
                      <button
                        onClick={() => toggleComments(post.id)}
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          zIndex: 5,
                          background: 'linear-gradient(135deg, #C4956A, #7B6FA0)',
                          color: 'white',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          boxShadow: '0 2px 6px rgba(196,149,106,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        💬 {post.comments_count} {post.comments_count === 1 ? 'réponse' : 'réponses'}
                      </button>
                    )}

                    <div className="p-4">
                      {/* Header post */}
                      <div className="flex items-center gap-2 mb-3" style={{ paddingRight: post.comments_count > 0 ? 110 : 0 }}>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-novae-gold/60 to-novae-rose/60 flex items-center justify-center text-white text-xs font-bold">
                          {post.pseudo?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-novae-anthracite">{post.pseudo}</span>
                        {post.user_id === user.id && (
                          <span className="text-xs text-novae-gold bg-novae-gold/10 px-1.5 py-0.5 rounded">Toi</span>
                        )}
                        <span className="ml-auto text-xs text-novae-anthracite/30">{formatDate(post.created_at)}</span>

                        {/* Menu ⋮ posts perso */}
                        {post.user_id === user.id && (
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setCommentMenuOpen(null)
                                setPostMenuOpen(postMenuOpen === post.id ? null : post.id)
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 18, color: '#999', lineHeight: 1 }}
                              aria-label="Options"
                            >
                              ⋮
                            </button>
                            {postMenuOpen === post.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute', top: 28, right: 0, zIndex: 50,
                                  background: 'white', borderRadius: 10,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                  border: '1px solid #eee', minWidth: 140, overflow: 'hidden',
                                }}
                              >
                                <button onClick={() => startEditPost(post)} style={menuItemStyle}>
                                  ✏️ Modifier
                                </button>
                                <button onClick={() => deletePost(post.id)} style={{ ...menuItemStyle, color: '#c44757' }}>
                                  🗑️ Supprimer
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Contenu ou édition */}
                      {editingPost === post.id ? (
                        <div>
                          <textarea
                            value={editPostContent}
                            onChange={(e) => setEditPostContent(e.target.value)}
                            className="w-full text-sm text-novae-anthracite bg-novae-cream/50 border border-novae-beige/40 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-novae-gold/30 resize-none"
                            rows={3}
                            maxLength={500}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => savePost(post.id)}
                              disabled={!editPostContent.trim()}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${editPostContent.trim() ? 'bg-novae-gold text-white' : 'bg-novae-beige/30 text-novae-anthracite/40'}`}
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={cancelEditPost}
                              className="px-3 py-1.5 bg-novae-beige/30 text-novae-anthracite/60 rounded-lg text-xs"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-novae-anthracite leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      )}
                    </div>

                    {/* Like + commenter */}
                    <div className="px-4 pb-3 flex items-center gap-4 border-t border-novae-beige/10 pt-2">
                      <button
                        onClick={() => handleLike(post)}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${post.liked_by_me ? 'text-novae-gold' : 'text-novae-anthracite/40 hover:text-novae-gold'}`}
                      >
                        <span>{post.liked_by_me ? '💛' : '🤍'}</span>
                        <span>{post.likes_count > 0 ? post.likes_count : ''}</span>
                      </button>

                      <button
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-1.5 text-xs transition-colors hover:text-novae-anthracite"
                        style={{ color: expandedPost === post.id ? '#C4956A' : undefined }}
                      >
                        <span>💬</span>
                        <span className="text-novae-anthracite/40">
                          {post.comments_count > 0 ? `${post.comments_count} ${post.comments_count === 1 ? 'réponse' : 'réponses'}` : 'Commenter'}
                        </span>
                      </button>
                    </div>

                    {/* Section commentaires */}
                    {expandedPost === post.id && (
                      <div className="border-t border-novae-beige/10 bg-novae-cream/50">
                        <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
                          {(comments[post.id] || []).map(comment => (
                            <div key={comment.id} className="flex gap-2">
                              <div className="w-6 h-6 rounded-full bg-novae-gold/20 flex items-center justify-center text-novae-gold text-xs font-bold flex-shrink-0">
                                {comment.pseudo?.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1" style={{ position: 'relative' }}>
                                {editingComment === comment.id ? (
                                  <div>
                                    <input
                                      value={editCommentContent}
                                      onChange={e => setEditCommentContent(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') saveComment(comment.id, post.id)
                                        if (e.key === 'Escape') cancelEditComment()
                                      }}
                                      className="w-full text-xs bg-white border border-novae-beige/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-novae-gold/30 text-novae-anthracite"
                                      maxLength={200}
                                      autoFocus
                                    />
                                    <div className="flex gap-2 mt-1">
                                      <button onClick={() => saveComment(comment.id, post.id)} className="text-xs text-novae-gold font-medium">
                                        ✓ Enregistrer
                                      </button>
                                      <button onClick={cancelEditComment} className="text-xs text-novae-anthracite/40">
                                        Annuler
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-xs font-medium text-novae-anthracite">{comment.pseudo} </span>
                                    <span className="text-xs text-novae-anthracite/70">{comment.content}</span>
                                    {comment.user_id === user.id && (
                                      <span style={{ display: 'inline-block', position: 'relative', marginLeft: 4 }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setPostMenuOpen(null)
                                            setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id)
                                          }}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#bbb', padding: '0 2px', lineHeight: 1 }}
                                          aria-label="Options commentaire"
                                        >
                                          ⋮
                                        </button>
                                        {commentMenuOpen === comment.id && (
                                          <div
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              position: 'absolute', top: 18, right: 0, zIndex: 30,
                                              background: 'white', borderRadius: 8,
                                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                              border: '1px solid #eee', minWidth: 130, overflow: 'hidden',
                                            }}
                                          >
                                            <button onClick={() => startEditComment(comment)} style={{ ...menuItemStyle, padding: '8px 12px', fontSize: 12 }}>
                                              ✏️ Modifier
                                            </button>
                                            <button onClick={() => deleteComment(comment.id, post.id)} style={{ ...menuItemStyle, padding: '8px 12px', fontSize: 12, color: '#c44757' }}>
                                              🗑️ Supprimer
                                            </button>
                                          </div>
                                        )}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                          {(comments[post.id] || []).length === 0 && (
                            <p className="text-xs text-novae-anthracite/30 text-center py-2">Sois la première à commenter</p>
                          )}
                        </div>
                        <div className="px-4 pb-3 flex gap-2">
                          <input
                            value={newComment[post.id] || ''}
                            onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleComment(post.id) }}
                            placeholder="Ton commentaire..."
                            className="flex-1 text-xs bg-white border border-novae-beige/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-novae-gold/30 text-novae-anthracite placeholder-novae-anthracite/30"
                            maxLength={200}
                          />
                          <button
                            onClick={() => handleComment(post.id)}
                            disabled={!newComment[post.id]?.trim()}
                            className={`px-3 py-2 rounded-lg text-xs transition-all ${newComment[post.id]?.trim() ? 'bg-novae-gold text-white' : 'bg-novae-beige/30 text-novae-anthracite/30'}`}
                          >
                            →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══ CHALLENGES ═══ */}
          {activeTab === 'challenges' && (
            <div className="space-y-4">
              <div className="bg-novae-gold/10 border border-novae-gold/20 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1">🎯</div>
                <p className="text-sm font-medium text-novae-anthracite">Défis de la semaine</p>
                <p className="text-xs text-novae-anthracite/50 mt-1">Lancés par NOVAÉ · Nouveaux défis chaque lundi</p>
              </div>
              {challenges.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">⏳</div>
                  <p className="text-novae-anthracite/40 text-sm">Aucun défi actif pour le moment.</p>
                </div>
              ) : (
                challenges.map(challenge => (
                  <div key={challenge.id} className="bg-white rounded-2xl border border-novae-beige/20 shadow-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-novae-gold/10 flex items-center justify-center text-2xl flex-shrink-0">{challenge.emoji}</div>
                      <div className="flex-1">
                        <h3 className="font-medium text-novae-anthracite text-sm">{challenge.title}</h3>
                        {challenge.description && (
                          <p className="text-xs text-novae-anthracite/50 mt-1 leading-relaxed">{challenge.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-novae-anthracite/40">📅 {formatChallengeDate(challenge.starts_at)} → {formatChallengeDate(challenge.ends_at)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-novae-anthracite/50">👥 {challenge.participants_count} participantes</span>
                          <span className="text-xs text-green-600">✅ {challenge.completed_count} ont réussi</span>
                        </div>
                        {(challenge.participants_count || 0) > 0 && (
                          <div className="mt-3">
                            <div className="h-1.5 bg-novae-beige/30 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-novae-gold rounded-full transition-all"
                                style={{ width: `${Math.round(((challenge.completed_count || 0) / (challenge.participants_count || 1)) * 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-novae-anthracite/30 mt-1">
                              {Math.round(((challenge.completed_count || 0) / (challenge.participants_count || 1)) * 100)}% de réussite
                            </p>
                          </div>
                        )}
                        <div className="mt-3">
                          {!challenge.my_participation ? (
                            <button
                              onClick={() => handleJoinChallenge(challenge.id)}
                              className="w-full py-2 bg-novae-anthracite text-white rounded-xl text-xs font-medium hover:bg-novae-gold transition-colors"
                            >
                              Rejoindre ce défi ✦
                            </button>
                          ) : challenge.my_participation.completed ? (
                            <div className="w-full py-2 bg-green-50 border border-green-200 rounded-xl text-xs font-medium text-green-600 text-center">
                              ✅ Défi relevé — Bravo !
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCompleteChallenge(challenge.id)}
                              className="w-full py-2 bg-novae-gold/10 border border-novae-gold/30 text-novae-gold rounded-xl text-xs font-medium hover:bg-novae-gold hover:text-white transition-colors"
                            >
                              Marquer comme complété 🎯
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══ RANKING ═══ */}
          {activeTab === 'ranking' && (
            <div className="space-y-4">

              <div className="bg-novae-anthracite rounded-2xl p-4 text-center">
                <p className="text-novae-gold text-xs font-medium uppercase tracking-widest mb-1">Classement du mois</p>
                <h2 className="font-serif text-2xl text-white">{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2>
                <p className="text-white/40 text-xs mt-1">Défis complétés ce mois-ci</p>
              </div>

              {myBadges.length > 0 && (
                <div className="bg-white rounded-2xl border border-novae-beige/20 shadow-sm p-4">
                  <h3 className="text-xs font-medium text-novae-anthracite/50 uppercase tracking-wide mb-3">Mes badges</h3>
                  <div className="flex flex-wrap gap-2">
                    {myBadges.map(badge => (
                      <div key={badge.id} className="flex items-center gap-1.5 bg-novae-gold/10 border border-novae-gold/20 rounded-full px-3 py-1.5">
                        <span className="text-sm">{BADGE_DEFINITIONS[badge.badge_type]?.emoji || '🏅'}</span>
                        <span className="text-xs text-novae-gold font-medium">{badge.badge_label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ranking.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🏆</div>
                  <p className="text-novae-anthracite/40 text-sm">Aucun défi complété ce mois-ci.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-novae-beige/20 shadow-sm overflow-hidden">
                  {ranking.map((entry, index) => (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-3 px-4 py-3 ${index < ranking.length - 1 ? 'border-b border-novae-beige/10' : ''} ${entry.isMe ? 'bg-novae-gold/5' : ''}`}
                    >
                      <span className="text-lg w-8 text-center flex-shrink-0">{getRankEmoji(entry.rank)}</span>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-novae-gold/60 to-novae-rose/60 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {entry.pseudo?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-novae-anthracite">
                          {entry.pseudo}
                          {entry.isMe && <span className="ml-2 text-xs text-novae-gold">← toi</span>}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-novae-gold">{entry.count}</span>
                        <span className="text-xs text-novae-anthracite/30 ml-1">défi{entry.count > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-novae-beige/20 shadow-sm p-4">
                <h3 className="text-xs font-medium text-novae-anthracite/50 uppercase tracking-wide mb-3">Badges à débloquer</h3>
                <div className="space-y-2">
                  {Object.entries(BADGE_DEFINITIONS).map(([type, def]) => {
                    const earned = myBadges.find(b => b.badge_type === type)
                    return (
                      <div key={type} className={`flex items-center gap-3 p-2 rounded-xl ${earned ? 'bg-novae-gold/5' : 'opacity-40'}`}>
                        <span className="text-xl">{def.emoji}</span>
                        <div>
                          <p className="text-xs font-medium text-novae-anthracite">{def.label}</p>
                          <p className="text-xs text-novae-anthracite/40">{def.desc}</p>
                        </div>
                        {earned && <span className="ml-auto text-xs text-novae-gold">✓ Obtenu</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  )
}