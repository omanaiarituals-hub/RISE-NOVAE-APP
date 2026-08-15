import FinanceEnvelopeDetail from '@/components/finance/FinanceEnvelopeDetail'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <FinanceEnvelopeDetail id={id} /> }
