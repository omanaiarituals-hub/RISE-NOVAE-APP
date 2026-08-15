import type { ReactNode } from 'react'
import FinanceComingSoon from '@/components/finance/FinanceComingSoon'
import FinanceShell from '@/components/finance/FinanceShell'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { createClient } from '@/lib/supabase/server'

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isFinanceBetaAllowed(user?.id)) {
    return <FinanceComingSoon />
  }

  return <FinanceShell>{children}</FinanceShell>
}
