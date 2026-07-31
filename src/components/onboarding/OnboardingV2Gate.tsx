'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { supabase } from '@/lib/supabase/client'

const EXCLUDED_PATHS = [
  '/auth',
  '/login',
  '/onboarding',
  '/subscribe',
  '/confidentialite',
  '/cgu',
]

export default function OnboardingV2Gate() {
  const { user, loading } = useSupabaseAuth()
  const pathname = usePathname()
  const router = useRouter()
  const checkedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (loading || !user || !pathname) return
    if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) return
    if (checkedUserId.current === user.id) return

    checkedUserId.current = user.id

    void (async () => {
      const { data, error } = await supabase
        .from('onboarding_v2_profiles')
        .select('onboarding_version, completed_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('[onboarding-v2-gate] profile check failed', error)
        checkedUserId.current = null
        return
      }

      const completed =
        data?.onboarding_version === 2 &&
        typeof data.completed_at === 'string' &&
        data.completed_at.length > 0

      if (!completed) {
        router.replace('/onboarding')
      }
    })()
  }, [loading, pathname, router, user])

  return null
}
