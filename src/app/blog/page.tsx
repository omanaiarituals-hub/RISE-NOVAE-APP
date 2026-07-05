// src/app/blog/page.tsx
// Page vitrine du blog : pensée pour une lectrice qui arrive depuis Google
// sans connaître NOVAÉ (pas seulement pour une utilisatrice déjà dans l'app).
// Server Component + ISR (voir revalidate plus bas) : rendu HTML complet à
// chaque régénération, aucun contenu ajouté en client-side.
import Link from 'next/link'
import { getPublishedArticles } from '@/lib/articles'

export const revalidate = 60

export default async function BlogPage() {
  const articles = await getPublishedArticles()

  const TAG_COLORS: Record<string, { bg: string; color: string }> = {
    'Neurosciences': { bg: 'rgba(212,196,226,0.35)', color: '#7E63A8' },
    'CBT':           { bg: 'rgba(197,211,180,0.35)', color: '#5C7044' },
    'Bien-être':     { bg: 'rgba(243,205,182,0.35)', color: '#B5654A' },
    'Routines':      { bg: 'rgba(245,216,155,0.35)', color: '#A8852E' },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #FBF4EC 0%, #F8F1E5 100%)', fontFamily: "'DM Sans', sans-serif" }}>

      {/* HERO VITRINE : logo, pitch produit, CTA */}
      <div style={{ background: 'linear-gradient(180deg, rgba(240,201,208,0.97), rgba(233,186,196,0.92))', borderBottom: '1px solid rgba(225,170,180,0.45)', padding: '28px 20px 32px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <Link href="/" style={{ textDecoration: 'none', fontSize: 13, color: '#5B3821', opacity: 0.6 }}>← Retour</Link>
          <div style={{ margin: '14px 0 18px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="NOVAÉ by OMANAÏA" style={{ height: 40, objectFit: 'contain' }} />
          </div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontStyle: 'italic', color: '#3d2618', margin: '0 0 18px', lineHeight: 1.5, maxWidth: 520 }}>
            J'ai créé NOVAÉ pour les femmes qui portent trop, tout le temps, sans jamais poser leur charge mentale. 90 jours de programme, une coach IA qui apprend à te connaître, des outils inspirés des neurosciences. Pas un journal de plus. Un système qui s'adapte à toi.
          </p>
          <Link href="/auth" style={{
            display: 'inline-block', background: '#B06A7C', color: '#fff', textDecoration: 'none',
            fontWeight: 600, fontSize: 14, padding: '12px 26px', borderRadius: 999,
          }}>
            Essayer 14 jours gratuitement
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 16px 80px' }}>

        {/* INTRO BLOG */}
        <div style={{ marginBottom: 24, padding: '16px 18px', background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(196,149,106,0.2)', borderRadius: 16 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#5B3821', marginBottom: 8 }}>Blog bien-être</div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontStyle: 'italic', color: '#3d2618', margin: 0, lineHeight: 1.6 }}>
            Des articles que j'écris pour démystifier ce qui se passe dans ta tête — et te donner des outils concrets, pas des injonctions.
          </p>
          <p style={{ fontSize: 11, color: '#8b6f55', margin: '8px 0 0' }}>— Ness, fondatrice de NOVAÉ</p>
        </div>

        {/* ARTICLES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {articles.map((article) => {
            const tagStyle = TAG_COLORS[article.category ?? ''] ?? { bg: 'rgba(245,216,155,0.35)', color: '#A8852E' }
            return (
              <Link key={article.slug} href={`/blog/${article.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(196,149,106,0.18)', borderRadius: 16, overflow: 'hidden', display: 'flex' }}>
                  {article.cover_image && (
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <img src={article.cover_image} alt={article.image_alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tagStyle.color, background: tagStyle.bg, borderRadius: 999, padding: '2px 8px' }}>{article.category}</span>
                      <span style={{ fontSize: 10, color: '#a08770' }}>{article.read_time}</span>
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: '#3d2618', lineHeight: 1.25, marginBottom: 6 }}>{article.title}</div>
                    <div style={{ fontSize: 12, color: '#6b5340', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{article.excerpt}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {articles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b6f55' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontStyle: 'italic' }}>Les premiers articles arrivent bientôt.</p>
          </div>
        )}

        {/* BLOC DE CONVERSION FIN DE LISTE */}
        <div style={{
          marginTop: 32, padding: '30px 26px', borderRadius: 20, textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(201,160,180,.22), rgba(192,133,82,.14))',
          border: '1px solid rgba(255,255,255,.7)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="NOVAÉ by OMANAÏA" style={{ height: 30, objectFit: 'contain', margin: '0 auto 14px' }} />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: '#3d2618', margin: '0 0 10px' }}>
            Tu es arrivée jusqu'ici. C'est peut-être le bon moment.
          </p>
          <p style={{ fontSize: 14, color: '#564c4f', lineHeight: 1.6, margin: '0 0 20px', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            NOVAÉ t'accompagne 90 jours pour poser ta charge mentale, avec une coach IA qui te connaît et des outils construits à partir des neurosciences.
          </p>
          <Link href="/auth" style={{
            display: 'inline-block', background: '#B06A7C', color: '#fff', textDecoration: 'none',
            fontWeight: 600, fontSize: 15, padding: '13px 28px', borderRadius: 999,
          }}>
            Essayer 14 jours gratuitement
          </Link>
        </div>
      </div>
    </div>
  )
}
