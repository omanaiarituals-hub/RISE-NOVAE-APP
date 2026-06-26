// src/app/blog/page.tsx
'use client'

import Link from 'next/link'
import { blogArticles } from '@/data/blog-articles'

export default function BlogPage() {
  const sorted = [...blogArticles].sort((a, b) => b.date.localeCompare(a.date))

  const TAG_COLORS: Record<string, { bg: string; color: string }> = {
    'Neurosciences': { bg: 'rgba(212,196,226,0.35)', color: '#7E63A8' },
    'CBT':           { bg: 'rgba(197,211,180,0.35)', color: '#5C7044' },
    'Bien-être':     { bg: 'rgba(243,205,182,0.35)', color: '#B5654A' },
    'Routines':      { bg: 'rgba(245,216,155,0.35)', color: '#A8852E' },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #FBF4EC 0%, #F8F1E5 100%)', fontFamily: "'DM Sans', sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(180deg, rgba(240,201,208,0.97), rgba(233,186,196,0.92))', borderBottom: '1px solid rgba(225,170,180,0.45)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ textDecoration: 'none', fontSize: 20, color: '#5B3821' }}>←</Link>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#5B3821' }}>Blog bien-être</div>
          <div style={{ fontSize: 10, color: '#A86B78', letterSpacing: '2px', textTransform: 'uppercase' }}>by NOVAÉ · OMANAÏA</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* INTRO */}
        <div style={{ marginBottom: 24, padding: '16px 18px', background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(196,149,106,0.2)', borderRadius: 16 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontStyle: 'italic', color: '#3d2618', margin: 0, lineHeight: 1.6 }}>
            Des articles que j'écris pour démystifier ce qui se passe dans ta tête — et te donner des outils concrets, pas des injonctions.
          </p>
          <p style={{ fontSize: 11, color: '#8b6f55', margin: '8px 0 0' }}>— Ness, fondatrice de NOVAÉ</p>
        </div>

        {/* ARTICLES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((article) => {
            const tagStyle = TAG_COLORS[article.tag] ?? { bg: 'rgba(245,216,155,0.35)', color: '#A8852E' }
            return (
              <Link key={article.slug} href={`/blog/${article.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(196,149,106,0.18)', borderRadius: 16, overflow: 'hidden', display: 'flex' }}>
                  {article.image && (
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <img src={article.image} alt={article.imageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tagStyle.color, background: tagStyle.bg, borderRadius: 999, padding: '2px 8px' }}>{article.tag}</span>
                      <span style={{ fontSize: 10, color: '#a08770' }}>{article.readTime}</span>
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: '#3d2618', lineHeight: 1.25, marginBottom: 6 }}>{article.title}</div>
                    <div style={{ fontSize: 12, color: '#6b5340', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{article.excerpt}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b6f55' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontStyle: 'italic' }}>Les premiers articles arrivent bientôt.</p>
          </div>
        )}
      </div>
    </div>
  )
}