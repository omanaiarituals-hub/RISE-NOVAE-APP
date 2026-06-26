'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  url: string | null
  icon: string | null
  read: boolean
  pushed: boolean
  metadata: any
  created_at: string
}

export default function NotificationBell() {
  const { user } = useSupabaseAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    loadNotifications()
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => loadNotifications())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Ferme sur clic extérieur (desktop)
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-notif-panel]')) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Bloque le scroll du body quand ouvert sur mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const loadNotifications = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20)
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    }
  }

  const markAsRead = async (notifId: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId)
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.read) await markAsRead(notif.id)
    setOpen(false)
    if (notif.url) router.push(notif.url)
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
    if (diffMin < 1) return "à l'instant"
    if (diffMin < 60) return `il y a ${diffMin} min`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `il y a ${diffHr}h`
    const diffDays = Math.floor(diffHr / 24)
    if (diffDays < 7) return `il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div data-notif-panel style={{ position: 'relative', display: 'inline-block' }}>
      {/* BOUTON CLOCHE */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(243,220,198,0.15)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(243,220,198,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', fontSize: 16, color: '#f3dcc6', cursor: 'pointer', padding: 0,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            background: 'linear-gradient(135deg, #c44757, #8b2d3d)',
            color: 'white', fontSize: 9, fontWeight: 700,
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #5b3821',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* OVERLAY sombre — couvre TOUT l'écran, zIndex très haut */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 9998,
              backdropFilter: 'none',
            }}
          />

          {/* PANNEAU — au-dessus de l'overlay */}
          <div style={{
            position: 'fixed',
            top: 0, right: 0,
            width: 'min(380px, 100vw)',
            height: '100dvh',
            background: '#FFFFFF',
            boxShadow: '-8px 0 32px rgba(91,56,33,0.18)',
            zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {/* HEADER */}
            <div style={{
              padding: '16px 18px',
              borderBottom: '1px solid rgba(196,149,106,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(135deg, #faf3ea, #f3dcc6)',
              flexShrink: 0,
            }}>
              <h3 style={{
                margin: 0, fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20, color: '#3d2618', fontWeight: 500,
              }}>
                Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: '#8b5a3c', fontWeight: 600, textDecoration: 'underline',
                  }}>
                    Tout lu
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, color: '#8b5a3c', lineHeight: 1, padding: '0 4px',
                }}>✕</button>
              </div>
            </div>

            {/* LISTE */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8b6f55' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🌸</div>
                  <p style={{ margin: 0, fontSize: 14 }}>Pas encore de notification</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.7 }}>Tes notifs s'afficheront ici</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid rgba(196,149,106,0.1)',
                      cursor: 'pointer',
                      background: notif.read ? '#FFFFFF' : 'rgba(196,149,106,0.07)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: notif.read ? 500 : 700, color: '#3d2618', lineHeight: 1.4 }}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c4956a', flexShrink: 0, marginTop: 5 }} />
                      )}
                    </div>
                    <p style={{ margin: '0 0 5px', fontSize: 12, color: '#6b5340', lineHeight: 1.5 }}>{notif.body}</p>
                    <p style={{ margin: 0, fontSize: 10, color: '#a08770' }}>{formatTime(notif.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}