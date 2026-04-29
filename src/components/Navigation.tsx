'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Sun, Calendar, Target, Zap, BarChart2,
  MessageSquare, Bot, ShoppingCart, Users, Settings2,
} from 'lucide-react'

const ADMIN_EMAIL = 'nesserinesediri@gmail.com'

const mobileItems = [
  { href: '/routines',   icon: Sun,           label: 'Routines'  },
  { href: '/planner',    icon: Calendar,      label: 'Planner'   },
  { href: '/program',    icon: Target,        label: 'Programme' },
  { href: '/defis',      icon: Zap,           label: 'Défis'     },
  { href: '/tracker',    icon: BarChart2,     label: 'Tracker'   },
  { href: '/community',  icon: MessageSquare, label: 'Commu.'    },
  { href: '/agent',      icon: Bot,           label: 'IA'        },
  { href: '/recipes',    icon: ShoppingCart,  label: 'Courses'   },
  { href: '/family',     icon: Users,         label: 'Famille'   },
]

export default function Navigation() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email === ADMIN_EMAIL) setIsAdmin(true)
    })
  }, [])

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-novae-beige/30 z-50">
      <div className="flex overflow-x-auto py-2 px-2 space-x-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {mobileItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-w-[60px] flex-shrink-0 hover:bg-novae-beige/20">
              <Icon size={20} className="mb-1 text-novae-anthracite/70" />
              <span className="text-xs font-medium text-novae-anthracite/70 text-center leading-tight">{item.label}</span>
            </Link>
          )
        })}

        {/* Bouton Admin — visible uniquement pour nesserinesediri@gmail.com */}
        {isAdmin && (
          <Link href="/admin"
            className="flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-w-[60px] flex-shrink-0"
            style={{ background: 'rgba(196,149,106,0.15)' }}>
            <Settings2 size={20} className="mb-1" style={{ color: '#C4956A' }} />
            <span className="text-xs font-medium text-center leading-tight" style={{ color: '#C4956A' }}>Admin</span>
          </Link>
        )}
      </div>
    </div>
  )
}