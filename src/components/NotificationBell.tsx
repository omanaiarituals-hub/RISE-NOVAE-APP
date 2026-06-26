'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current && !btnRef.current.contains(target)) {
        const panel = document.getElementById('notif-panel')
        if (panel && !panel.contains(target)) setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleToggle = () => {
    if (!open && btnRef.current) {
      setBtnRect(btnRef.current.getBoundingClientRect())
    }
    setOpen(o => !o)
  }

  const loadNotifications = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
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

  // Calcul position du panel (ancré sous le bouton, jamais hors écran)
  const getPanelStyle = (): React.CSSProperties => {
    const W = 340
    const margin = 12
    let top = (btnRect?.bottom ?? 60) + 10
    let right = window.innerWidth - (btnRect?.right ?? window.innerWidth - margin) - margin
    right = Math.max(margin, Math.min(right, window.innerWidth - W - margin))
    return {
      position: 'fixed',
      top,
      right,
      width: W,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      maxHeight: '75vh',
      background: '#FFFFFF',
      border: '1px solid rgba(196,149,106,0.25)',
      borderRadius: 16,
      boxShadow: '0 16px 40px rgba(91,56,33,0.22)',
      overflow: 'hidden',
      zIndex: 99999,
      fontFamily: "'DM Sans', sans-serif",
    }
  }

  const panel = open && mounted && btnRect ? createPortal(
    <div id="notif-panel" style={getPanelStyle()}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(196,149,106,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #faf3ea, #f3dcc6)' }}>
        <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#3d2618', fontWeight: 500 }}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#8b5a3c', fontWeight: 600, textDecoration: 'underline' }}>
              Tout marquer lu
            </button>
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8b6f55', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      </div>

      {/* Liste */}
      <div style={{ maxHeight: 'calc(75vh - 56px)', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8b6f55' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌸</div>
            <p style={{ margin: 0, fontSize: 13 }}>Pas encore de notification</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.7 }}>Tes notifs s'afficheront ici</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              style={{ padding: '12px 16px', borderBottom: '1px solid rgba(196,149,106,0.1)', cursor: 'pointer', background: notif.read ? '#FFFFFF' : 'rgba(196,149,106,0.08)', transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#faf3ea' }}
              onMouseLeave={e => { e.currentTarget.style.background = notif.read ? '#FFFFFF' : 'rgba(196,149,106,0.08)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: notif.read ? 500 : 700, color: '#3d2618' }}>{notif.title}</p>
                {!notif.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c4956a', flexShrink: 0, marginTop: 6 }} />}
              </div>
              <p style={{ margin: '2px 0 4px', fontSize: 12, color: '#6b5340', lineHeight: 1.4 }}>{notif.body}</p>
              <p style={{ margin: 0, fontSize: 10, color: '#a08770' }}>{formatTime(notif.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Notifications"
        style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(243,220,198,0.15)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(243,220,198,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', fontSize: 16, color: '#f3dcc6', cursor: 'pointer', padding: 0 }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, background: 'linear-gradient(135deg, #c44757, #8b2d3d)', color: 'white', fontSize: 9, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #5b3821', boxShadow: '0 2px 4px rgba(0,0,0,0.25)' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </>
  )
}