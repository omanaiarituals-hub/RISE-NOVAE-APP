'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { User, LogOut, Settings, CreditCard } from 'lucide-react'

export function UserMenu() {
  const { user, signOut } = useSupabaseAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  if (!user) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-novae-beige/20 transition-colors"
      >
        <div className="w-8 h-8 bg-novae-gold text-white rounded-full flex items-center justify-center text-sm font-bold">
          {user.email?.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm text-novae-anthracite">
          {user.email?.split('@')[0]}
        </span>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-novae-beige/30 z-20">
            <div className="p-3 border-b border-novae-beige/30">
              <p className="text-sm font-medium text-novae-anthracite">
                {user.email}
              </p>
              <p className="text-xs text-novae-anthracite/60">
                Compte Gratuit
              </p>
            </div>
            
            <div className="py-2">
              <button
                onClick={() => {
                  router.push('/settings')
                  setIsOpen(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-novae-anthracite hover:bg-novae-beige/20 flex items-center gap-2"
              >
                <Settings size={16} />
                Paramètres
              </button>
              
              <button
                onClick={() => {
                  router.push('/subscription')
                  setIsOpen(false)
                }}
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
