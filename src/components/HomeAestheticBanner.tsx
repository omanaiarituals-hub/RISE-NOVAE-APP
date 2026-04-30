'use client'

import { useEffect, useState } from 'react'

// Saisonnalité : mot-clé Unsplash + ambiance par mois
const MONTHLY_CONFIG = [
  { month: 1,  query: 'winter+minimal+snow+landscape',    label: 'Janvier',   mood: 'Silence et clarté'         },
  { month: 2,  query: 'frost+morning+minimal+nature',     label: 'Février',   mood: 'Lumière froide'            },
  { month: 3,  query: 'spring+bloom+minimal+pastel',      label: 'Mars',      mood: 'Premiers bourgeons'        },
  { month: 4,  query: 'rain+soft+light+minimal+green',    label: 'Avril',     mood: 'Pluie douce, renouveau'   },
  { month: 5,  query: 'green+nature+minimal+field',       label: 'Mai',       mood: 'Verdure fraîche'          },
  { month: 6,  query: 'golden+hour+minimal+summer',       label: 'Juin',      mood: 'Lumière chaude et longue' },
  { month: 7,  query: 'summer+light+airy+sky+minimal',    label: 'Juillet',   mood: 'Chaleur et ciel ouvert'   },
  { month: 8,  query: 'dry+field+golden+minimal+sun',     label: 'Août',      mood: 'Ocre et chaleur sèche'    },
  { month: 9,  query: 'autumn+light+minimal+leaves',      label: 'Septembre', mood: 'L\'or de la transition'   },
  { month: 10, query: 'fog+forest+minimal+autumn',        label: 'Octobre',   mood: 'Brume et profondeur'      },
  { month: 11, query: 'bare+tree+minimal+grey+sky',       label: 'Novembre',  mood: 'Dénudé, introspection'    },
  { month: 12, query: 'night+blue+minimal+winter+calm',   label: 'Décembre',  mood: 'Bleu nuit, intériorité'   },
]

const UNSPLASH_ACCESS_KEY = 'IQRcRQdwRp9HiiI9rPFVMB7MfXp03UuG7LHQSN1Hs44'
const CACHE_PREFIX = 'novae-seasonal-img-'

interface BannerImage {
  url: string
  author: string
  authorUrl: string
  month: number
}

export function HomeAestheticBanner() {
  const [image, setImage] = useState<BannerImage | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const currentMonth = new Date().getMonth() + 1
  const config = MONTHLY_CONFIG.find(c => c.month === currentMonth) || MONTHLY_CONFIG[0]

  useEffect(() => {
    loadImage()
  }, [])

  const loadImage = async () => {
    const cacheKey = `${CACHE_PREFIX}${currentMonth}`
    const cached = localStorage.getItem(cacheKey)

    if (cached) {
      try {
        const data = JSON.parse(cached)
        // Cache valide si même mois
        if (data.month === currentMonth) {
          setImage(data)
          return
        }
      } catch {}
    }

    // Fetch Unsplash
    try {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?query=${config.query}&orientation=landscape&content_filter=high`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
      )

      if (!res.ok) throw new Error('Unsplash error')

      const data = await res.json()
      const img: BannerImage = {
        url: data.urls?.regular || data.urls?.full,
        author: data.user?.name || '',
        authorUrl: data.user?.links?.html || '',
        month: currentMonth,
      }

      localStorage.setItem(cacheKey, JSON.stringify(img))
      setImage(img)
    } catch {
      // Fallback : image Unsplash statique par mois si l'API échoue
      const fallbacks: Record<number, string> = {
        1:  'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=70',
        2:  'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?w=800&q=70',
        3:  'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=800&q=70',
        4:  'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&q=70',
        5:  'https://images.unsplash.com/photo-1490750967868-88df5691cc11?w=800&q=70',
        6:  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70',
        7:  'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&q=70',
        8:  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=70',
        9:  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=70',
        10: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=70',
        11: 'https://images.unsplash.com/photo-1482192505345-5852583c8e98?w=800&q=70',
        12: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=800&q=70',
      }
      setImage({
        url: fallbacks[currentMonth] || fallbacks[1],
        author: '',
        authorUrl: '',
        month: currentMonth,
      })
      setError(true)
    }
  }

  if (!image) return null

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 180,
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 20,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    }}>
      {/* Image de fond */}
      <img
        src={image.url}
        alt={`Paysage ${config.label}`}
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s ease',
          filter: 'brightness(0.82) saturate(0.9)',
        }}
      />

      {/* Skeleton pendant le chargement */}
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #E8E0D8 25%, #F0E8DC 50%, #E8E0D8 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }} />
      )}

      {/* Overlay crème pour lisibilité + cohérence palette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(26,26,26,0.55) 0%, rgba(26,26,26,0.08) 60%, transparent 100%)',
      }} />

      {/* Contenu texte */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 18px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 13, fontStyle: 'italic',
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: '0.03em',
            lineHeight: 1.3,
          }}>
            {config.mood}
          </p>
          <p style={{
            margin: '3px 0 0',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontWeight: 600,
            color: '#FFFFFF',
            lineHeight: 1,
            letterSpacing: '0.02em',
          }}>
            {config.label}
          </p>
        </div>

        {/* Crédit photo discret */}
        {image.author && !error && (
          <a
            href={`${image.authorUrl}?utm_source=novae_app&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)',
              textDecoration: 'none', fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.04em',
            }}
          >
            📷 {image.author}
          </a>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }
      `}</style>
    </div>
  )
}