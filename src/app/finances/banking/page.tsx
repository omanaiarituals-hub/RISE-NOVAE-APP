import FinanceBankingClient from '@/components/finance/FinanceBankingClient'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; code?: string; error?: string; error_description?: string }>
}) {
  const params = await searchParams
  return (
    <FinanceBankingClient
      returnedFromProvider={params.connection === 'return' || Boolean(params.code)}
      authorizationCode={params.code}
      providerError={params.error_description || params.error}
    />
  )
}
