'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DemoBanner } from '@/components/DemoBanner'
import PremiumIcon, { type PremiumIconName } from '@/components/ui/PremiumIcon'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

type ContextStats = {
  members: number
  children: number
  places: number
  custodyConfigured: boolean
}

type UniverseCard = {
  href: string
  icon: PremiumIconName
  title: string
  description: string
  meta?: string
}

const C = {
  cream: '#FBF6EE',
  paper: '#FFFDFC',
  ink: '#3D2618',
  muted: '#7D6C61',
  copper: '#B9784B',
  copperSoft: 'rgba(185,120,75,0.10)',
  border: 'rgba(185,120,75,0.18)',
  green: '#5E9A82',
}

export default function ProfilPage() {
  const { user, loading } = useSupabaseAuth()
  const router = useRouter()
  const [stats, setStats] = useState<ContextStats>({
    members: 0,
    children: 0,
    places: 0,
    custodyConfigured: false,
  })
  const [contextLoading, setContextLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadContext = async () => {
      setContextLoading(true)
      try {
        const { data, error } = await supabase
          .from('family_data')
          .select('data_type, data, is_active')
          .eq('user_id', user.id)
          .neq('is_active', false)

        if (error) throw error
        if (cancelled) return

        const rows = data || []
        const members = rows.filter((row: any) => row.data_type === 'member')
        const children = members.filter((row: any) => row.data?.relation === 'enfant')
        const places = rows.filter((row: any) => row.data_type === 'location_config')
        const custodyConfigured = rows.some((row: any) => row.data_type === 'custody_config')

        setStats({
          members: members.length,
          children: children.length,
          places: places.length,
          custodyConfigured,
        })
      } catch (error) {
        console.error('[MonUnivers] load context error', error)
      } finally {
        if (!cancelled) setContextLoading(false)
      }
    }

    void loadContext()

    return () => {
      cancelled = true
    }
  }, [user])

  const cards = useMemo<UniverseCard[]>(() => [
    {
      href: '/family',
      icon: 'family',
      title: 'Foyer & entourage',
      description: 'Les personnes importantes, les enfants, la garde, les préférences et les repères utiles à Nova.',
      meta: contextLoading
        ? 'Chargement…'
        : `${stats.members} personne${stats.members > 1 ? 's' : ''}${stats.children ? ` · ${stats.children} enfant${stats.children > 1 ? 's' : ''}` : ''}`,
    },
    {
      href: '/personnalisation',
      icon: 'sliders',
      title: 'Personnalisation de Nova',
      description: 'Le ton, les priorités, les rappels et la façon dont Nova doit t’accompagner au quotidien.',
      meta: 'Adapter Nova',
    },
    {
      href: '/family#locations-panel',
      icon: 'home',
      title: 'Mes adresses',
      description: 'Domicile, travail, école et autres lieux récurrents que Nova peut utiliser pour mieux organiser tes trajets.',
      meta: stats.places > 0
        ? `${stats.places} configuration de lieux enregistrée`
        : 'Ajouter mes repères',
    },
    {
      href: '/settings',
      icon: 'shield',
      title: 'Paramètres & confidentialité',
      description: 'Notifications, sécurité, données personnelles et réglages généraux de ton compte.',
      meta: 'Ouvrir les paramètres',
    },
  ], [contextLoading, stats])

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, display: 'grid', placeItems: 'center' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: C.copper,
                opacity: 0.55 + i * 0.18,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <DemoBanner />
      <main style={{ minHeight: '100vh', background: C.cream, padding: '28px 18px 110px' }}>
        <div style={{ width: 'min(920px, 100%)', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 30 }}>
            <div>
              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: C.muted,
                  fontSize: 13,
                  textDecoration: 'none',
                  marginBottom: 14,
                }}
              >
                ← Accueil
              </Link>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.copper, fontWeight: 800 }}>
                Ce que Nova connaît de toi
              </p>
              <h1
                style={{
                  margin: '7px 0 6px',
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 'clamp(34px, 6vw, 52px)',
                  lineHeight: 1,
                  color: C.ink,
                  fontWeight: 500,
                }}
              >
                Mon univers
              </h1>
              <p style={{ margin: 0, maxWidth: 620, color: C.muted, fontSize: 14, lineHeight: 1.65 }}>
                Ici, tu retrouves les informations qui permettent à Nova de comprendre ton quotidien sans que tu aies à tout répéter.
              </p>
            </div>

            <div
              aria-hidden="true"
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                display: 'grid',
                placeItems: 'center',
                background: C.paper,
                color: C.copper,
                border: `1px solid ${C.border}`,
                boxShadow: '0 14px 34px rgba(76,48,32,0.08)',
                flexShrink: 0,
              }}
            >
              <PremiumIcon name="sparkle" width={29} height={29} />
            </div>
          </div>

          <section
            style={{
              background: C.paper,
              border: `1px solid ${C.border}`,
              borderRadius: 26,
              padding: '20px 22px',
              marginBottom: 18,
              boxShadow: '0 12px 30px rgba(76,48,32,0.055)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: C.copperSoft,
                  color: C.copper,
                  flexShrink: 0,
                }}
              >
                <PremiumIcon name="user" width={21} height={21} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: C.ink, fontWeight: 800, fontSize: 14 }}>
                  Ton compte NOVAÉ
                </p>
                <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 13, overflowWrap: 'anywhere' }}>
                  {user.email}
                </p>
                <p style={{ margin: '9px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.55 }}>
                  Les informations de cet espace servent uniquement à personnaliser ton expérience et les réponses de Nova.
                </p>
              </div>
            </div>
          </section>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            {cards.map(card => (
              <Link
                key={card.href}
                href={card.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 190,
                  padding: 20,
                  color: 'inherit',
                  textDecoration: 'none',
                  background: C.paper,
                  border: `1px solid ${C.border}`,
                  borderRadius: 24,
                  boxShadow: '0 10px 28px rgba(76,48,32,0.045)',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 15,
                    display: 'grid',
                    placeItems: 'center',
                    color: card.href === '/family' ? C.green : C.copper,
                    background: card.href === '/family' ? 'rgba(94,154,130,0.10)' : C.copperSoft,
                    marginBottom: 18,
                  }}
                >
                  <PremiumIcon name={card.icon} width={22} height={22} />
                </div>

                <h2
                  style={{
                    margin: 0,
                    color: C.ink,
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 24,
                    fontWeight: 600,
                    lineHeight: 1.1,
                  }}
                >
                  {card.title}
                </h2>
                <p style={{ margin: '9px 0 18px', color: C.muted, fontSize: 13, lineHeight: 1.58 }}>
                  {card.description}
                </p>

                <div
                  style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    color: C.copper,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <span>{card.meta}</span>
                  <PremiumIcon name="chevron" width={16} height={16} />
                </div>
              </Link>
            ))}
          </div>

          <p style={{ margin: '22px 4px 0', color: C.muted, fontSize: 11.5, lineHeight: 1.55, textAlign: 'center' }}>
            Tu peux modifier ces informations quand ton quotidien change. Nova utilisera toujours la version la plus récente.
          </p>
        </div>
      </main>
    </>
  )
}
