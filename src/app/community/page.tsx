'use client'

import Navigation from '@/components/Navigation'

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-novae-cream">
      <Navigation />
      
      <div className="md:ml-64 mb-20 md:mb-0">
        <main className="p-6 md:p-8">
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-serif text-novae-anthracite mb-4">
              Communauté
            </h1>
            <p className="text-lg text-novae-anthracite/70">
              Rejoignez notre communauté et partagez vos expériences.
            </p>
          </header>

          <div className="card">
            <h2 className="text-2xl font-serif text-novae-anthracite mb-4">Espace d'échange</h2>
            <p className="text-novae-anthracite/60">
              Cette section sera bientôt disponible avec le forum communautaire.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
