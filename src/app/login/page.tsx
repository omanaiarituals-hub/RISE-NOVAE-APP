'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulation d'une connexion - à remplacer avec une vraie authentification
    setTimeout(() => {
      setIsLoading(false)
      router.push('/')
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif text-novae-gold mb-2">Novae</h1>
          <p className="text-novae-anthracite/60">Votre compagnon de vie</p>
        </div>

        <div className="card">
          <h2 className="text-2xl font-serif text-novae-anthracite mb-6 text-center">
            Connexion
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-novae-anthracite mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="votre@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-novae-anthracite mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Votre mot de passe"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-novae-anthracite/60">
              Pas encore de compte ?{' '}
              <a href="#" className="text-novae-gold hover:text-novae-gold-light">
                S'inscrire
              </a>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-novae-anthracite/40">
            <a href="/cgu" className="hover:text-novae-anthracite/60">CGU</a>
            {' · '}
            <a href="/confidentialite" className="hover:text-novae-anthracite/60">
              Confidentialité
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
