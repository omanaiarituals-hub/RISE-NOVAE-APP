import FinanceAnalysisPlanner from '@/components/finance/FinanceAnalysisPlanner'
import FinanceCycleClosure from '@/components/finance/FinanceCycleClosure'
import FinanceTransactionIntelligence from '@/components/finance/FinanceTransactionIntelligence'

export default function Page(){
  return <div className="grid gap-5"><FinanceTransactionIntelligence/><FinanceAnalysisPlanner/><FinanceCycleClosure/></div>
}
