import FinanceGoalDetail from '@/components/finance/FinanceGoalDetail'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <FinanceGoalDetail id={id} /> }
