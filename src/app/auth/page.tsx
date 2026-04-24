'use client'

import { useState, useEffect } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const { signIn, signUp, signInWithMagicLink, user } = useSupabaseAuth()
  const router = useRouter()

  // Redirection automatique après connexion réussie
  useEffect(() => {
    if (user && !isSignUp) {
      router.push('/')
    }
  }, [user, isSignUp, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) {
          setMessage(error.message)
        } else {
          setMessage('Inscription réussie ! Vérifiez votre email.')
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setMessage(error.message)
        } else {
          setMessage('Connexion réussie ! Redirection...')
        }
      }
    } catch (error) {
      setMessage('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      setMessage('Veuillez entrer votre email')
      return
    }

    setLoading(true)
    try {
      const { error } = await signInWithMagicLink(email)
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Lien magique envoyé ! Vérifiez votre email.')
      }
    } catch (error) {
      setMessage('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center p-6">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif text-novae-anthracite mb-4">
            {isSignUp ? 'Rejoindre Novae' : 'Connexion Novae'}
          </h1>
          <p className="text-novae-anthracite/70">
            Votre compagnon de vie personnel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-novae-anthracite mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-novae-beige/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-novae-gold/50"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-novae-anthracite mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-novae-beige/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-novae-gold/50"
              placeholder="Créer un mot de passe"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('réussie') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Chargement...' : isSignUp ? "S'inscrire" : 'Se connecter'}
          </button>
        </form>

        {!isSignUp && (
          <div className="mt-4 text-center">
            <button
              onClick={handleMagicLink}
              disabled={loading}
              className="text-novae-gold hover:text-novae-gold-light text-sm"
            >
              Connexion par lien magique
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setMessage('')
              setPassword('')
            }}
            className="text-novae-anthracite/70 hover:text-novae-anthracite text-sm"
          >
            {isSignUp 
              ? 'Déjà un compte ? Se connecter' 
              : 'Pas de compte ? Créer un compte'
            }
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link 
            href="/"
            className="text-novae-anthracite/60 hover:text-novae-anthracite text-sm"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
