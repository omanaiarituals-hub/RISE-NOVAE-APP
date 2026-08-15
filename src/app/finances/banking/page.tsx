import FinanceBankingClient from '@/components/finance/FinanceBankingClient'

export default async function Page({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const params = await searchParams
  return <FinanceBankingClient returnedFromProvider={params.connection === 'return'} />
}
