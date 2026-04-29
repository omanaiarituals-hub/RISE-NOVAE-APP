'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { User, LogOut, Settings, CreditCard, Sparkles, ShieldCheck } from 'lucide-react'

const ADMIN_EMAIL = 'nesserinesediri@gmail.com'

export function UserMenu() {
  const { user, signOut } = useSupabaseAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  if (!user) return null

  const pseudo = user.user_metadata?.pseudo || user.user_metadata?.full_name || user.email?.split('@')[0]
  const isAdmin = user.email === ADMIN_EMAIL

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => router.push('/profil')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-novae-gold/10 border border-novae-gold/20 hover:bg-novae-gold/20 transition-colors"
      >
        <Sparkles size={13} className="text-novae-gold" />
        <span className="text-xs font-medium text-novae-gold">Mon Profil</span>
      </button>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-novae-beige/20 transition-colors"
      >
        <div className="w-8 h-8 bg-novae-gold text-white rounded-full flex items-center justify-center text-sm font-bold">
          {user.email?.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm text-novae-anthracite hidden md:block">{pseudo}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-novae-beige/30 z-20">
            <div className="p-3 border-b border-novae-beige/30">
              <p className="text-sm font-medium text-novae-anthracite">{pseudo}</p>
              <p className="text-xs text-novae-anthracite/60">{user.email}</p>
            </div>
            <div className="py-2">
              {isAdmin && (
                <button
                  onClick={() => { router.push('/admin'); setIsOpen(false) }}
                  className="w-full px-4 py-2 text-left text-sm font-semibold hover:bg-amber-50 flex items-center gap-2"
                  style={{ color: '#C4956A' }}
                >
                  <ShieldCheck size={16} />
                  Administration
                </button>
              )}
              <button
                onClick={() => { router.push('/profil'); setIsOpen(false) }}
                className="w-full px-4 py-2 text-left text-sm text-novae-anthracite hover:bg-novae-beige/20 flex items-center gap-2"
              >
                <Sparkles size={16} />
                Mon Profil
              </button>
              <button
                onClick={() => { router.push('/settings'); setIsOpen(false) }}
                className="w-full px-4 py-2 text-left text-sm text-novae-anthracite hover:bg-novae-beige/20 flex items-center gap-2"
              >
                <Settings size={16} />
                Paramètres
              </button>
              <button
                onClick={() => { router.push('/subscription'); setIsOpen(false) }}
                className="w-full px-4 py-2 text-left text-sm text-novae-anthracite hover:bg-novae-beige/20 flex items-center gap-2"
              >
                <CreditCard size={16} />
                Abonnement
              </button>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}