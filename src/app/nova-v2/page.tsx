'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import NovaV2Client from './NovaV2Client'

export default function NovaV2Page() {
  const { user, loading } = useSupabaseAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, router, user])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F5F1]">
        <p className="font-serif text-2xl text-[#6F5B8E]">
          Nova prépare ton espace…
        </p>
      </main>
    )
  }

  if (!user) return null

  return <NovaV2Client userId={user.id} userEmail={user.email || ''} />
}