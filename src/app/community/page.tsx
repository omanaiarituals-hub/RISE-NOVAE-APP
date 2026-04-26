'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CommunityPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="min-h-screen bg-novae-cream">
      {/* Header */}
      <div className="bg-white border-b border-novae-beige/30 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-novae-anthracite/50 hover:text-novae-anthracite transition-colors text-sm">
          ← Accueil
        </Link>
        <h1 className="font-serif text-xl text-novae-anthracite">Communauté</h1>
        <span className="ml-auto px-2 py-1 bg-novae-gold/10 text-novae-gold text-xs rounded-lg font-medium border border-novae-gold/20">Bientôt</span>
      </div>

      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-6">👭</div>
          <h2 className="font-serif text-3xl text-novae-anthracite mb-4">
            Elles se transforment,<br /><span className="italic text-novae-gold">ensemble</span>
          </h2>
          <p className="text-novae-anthracite/60 text-sm leading-relaxed max-w-sm mx-auto">
            La communauté NOVAÉ arrive bientôt. Un espace bienveillant pour partager, s'encourager et célébrer chaque victoire — petite ou grande.
          </p>
        </div>

        {/* Features à venir */}
        <div className="space-y-3 mb-10">
          {[
            { emoji: '🎯', title: 'Défis collectifs', desc: 'Relevez des défis en groupe et célébrez ensemble' },
            { emoji: '💬', title: 'Cercles de transformation', desc: 'Rejoins un petit groupe avec les mêmes objectifs' },
            { emoji: '🏆', title: 'Célébrations', desc: 'Partage tes victoires, inspire les autres' },
            { emoji: '🤝', title: 'Accountability partner', desc: 'Une partenaire qui veille sur ta progression' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-novae-beige/20 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 bg-novae-cream rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                {item.emoji}
              </div>
              <div>
                <div className="font-medium text-novae-anthracite text-sm">{item.title}</div>
                <div className="text-novae-anthracite/50 text-xs mt-0.5">{item.desc}</div>
              </div>
              <span className="ml-auto text-xs text-novae-anthracite/30 flex-shrink-0">Bientôt</span>
            </div>
          ))}
        </div>

        {/* Inscription liste d'attente */}
        {!submitted ? (
          <div className="bg-white rounded-2xl p-6 border border-novae-gold/20 shadow-sm">
            <h3 className="font-serif text-lg text-novae-anthracite mb-2 text-center">
              Rejoins la liste d'attente
            </h3>
            <p className="text-novae-anthracite/50 text-xs text-center mb-5 leading-relaxed">
              Sois parmi les premières à accéder à la communauté NOVAÉ dès son ouverture.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="flex-1 px-4 py-3 bg-novae-cream border border-novae-beige/40 rounded-xl text-sm text-novae-anthracite placeholder-novae-anthracite/30 focus:outline-none focus:ring-2 focus:ring-novae-gold/30"
              />
              <button
                onClick={() => { if (email.includes('@')) setSubmitted(true) }}
                className="px-4 py-3 bg-novae-anthracite text-white rounded-xl text-sm font-medium hover:bg-novae-gold transition-colors flex-shrink-0"
              >
                →
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-novae-gold/10 border border-novae-gold/20 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">✨</div>
            <h3 className="font-serif text-lg text-novae-anthracite mb-2">Tu es sur la liste !</h3>
            <p className="text-novae-anthracite/60 text-sm leading-relaxed">
              On te préviendra dès que la communauté NOVAÉ ouvre ses portes. Merci de ta confiance.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-novae-anthracite/30 mt-6">
          Lancement prévu : Été 2026
        </p>
      </div>
    </div>
  )
}