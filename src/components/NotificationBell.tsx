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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!user) return
    loadNotifications()
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => loadNotifications())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Position fixed : top sous le bouton, aligné à droite du bouton
      // On s'assure que ça ne déborde pas à gauche
      const dropdownWidth = Math.min(360, window.innerWidth - 24)
      const rightOffset = window.innerWidth - rect.right
      setDropdownPos({
        top: rect.bottom + 10,
        right: Math.max(12, rightOffset),
      })
    }
    setOpen(!open)
  }

  const loadNotifications = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
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

  const dropdownWidth = typeof window !== 'undefined'
    ? Math.min(360, window.innerWidth - 24)
    : 360

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        aria-label="Notifications"
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(243, 220, 198, 0.15)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(243, 220, 198, 0.25)',
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
            border: '2px solid #5b3821', boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN en position FIXED — passe au-dessus de tout, même les backdropFilter */}
      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            right: dropdownPos.right,
            width: dropdownWidth,
            maxHeight: 480,
            background: '#FFFFFF',
            border: '1px solid rgba(196, 149, 106, 0.25)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(91, 56, 33, 0.22)',
            overflow: 'hidden',
            zIndex: 9999,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(196, 149, 106, 0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, #faf3ea, #f3dcc6)',
          }}>
            <h3 style={{
              margin: 0, fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18, color: '#3d2618', fontWeight: 500,
            }}>
              Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: '#8b5a3c', fontWeight: 600, textDecoration: 'underline',
              }}>
                Tout marquer lu
              </button>
            )}
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
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
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(196, 149, 106, 0.1)',
                    cursor: 'pointer',
                    background: notif.read ? '#FFFFFF' : 'rgba(196,149,106,0.08)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#faf3ea' }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = notif.read ? '#FFFFFF' : 'rgba(196,149,106,0.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: notif.read ? 500 : 700, color: '#3d2618' }}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c4956a', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                  <p style={{ margin: '2px 0 4px', fontSize: 12, color: '#6b5340', lineHeight: 1.4 }}>{notif.body}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#a08770' }}>{formatTime(notif.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}