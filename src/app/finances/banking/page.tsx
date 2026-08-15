import FinancePlaceholderPage from '@/components/finance/FinancePlaceholderPage'

export default function Page() {
  return <FinancePlaceholderPage eyebrow="Open Banking" title="Connexion bancaire" description="Lecture seule uniquement. Aucun paiement, aucun virement et aucun identifiant bancaire saisi dans NOVAÉ. Le prochain lot branchera la sandbox fournisseur derrière l’abstraction BankingProvider." primaryHref="/api/finance/provider-status" primaryLabel="Vérifier l’état technique" />
}
