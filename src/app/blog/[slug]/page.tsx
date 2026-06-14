import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getArticle, getAllSlugs, blogArticles } from '@/data/blog-articles'

export const dynamicParams = false

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return { title: 'Article introuvable | NOVAÉ' }

  const url = `https://app.novae-by-omanaia.com/blog/${article.slug}`
  return {
    title: article.metaTitle,
    description: article.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      url,
      type: 'article',
      siteName: 'NOVAÉ by OMANAÏA',
      images: [{ url: article.image, alt: article.imageAlt }],
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDescription,
      images: [article.image],
    },
  }
}

function formatDateFr(iso: string): string {
  const mois = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ]
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10))
  return `${d} ${mois[m - 1]} ${y}`
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const url = `https://app.novae-by-omanaia.com/blog/${article.slug}`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    image: article.image,
    datePublished: article.date,
    dateModified: article.date,
    author: { '@type': 'Person', name: 'Ness Sediri', url: 'https://novae-by-omanaia.com' },
    publisher: {
      '@type': 'Organization',
      name: 'NOVAÉ by OMANAÏA',
      url: 'https://novae-by-omanaia.com',
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const others = blogArticles.filter((a) => a.slug !== article.slug).slice(0, 2)

  return (
    <div className="novae-blog">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap');

.novae-blog{
  --bg:#FBF6F2; --paper:#ffffff; --ink:#2B2228; --muted:#7a6f72;
  --rose:#C9A0B4; --rose-dark:#B06A7C; --copper:#C08552; --line:rgba(43,34,40,.10);
  background:
    radial-gradient(ellipse at 50% -10%, rgba(201,160,180,.18) 0%, transparent 55%),
    linear-gradient(180deg, var(--bg) 0%, #fff 60%);
  min-height:100vh; color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.novae-blog *{box-sizing:border-box}
.nb-topbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 28px;max-width:1100px;margin:0 auto;
}
.nb-logo{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;letter-spacing:1px;color:var(--ink);text-decoration:none}
.nb-logo small{font-size:9px;letter-spacing:3px;color:var(--copper);display:block;font-family:inherit;font-weight:500;margin-top:-2px}
.nb-top-actions{display:flex;align-items:center;gap:18px}
.nb-back{color:var(--muted);text-decoration:none;font-size:13px;font-weight:500}
.nb-back:hover{color:var(--rose-dark)}
.nb-cta-top{background:var(--rose-dark);color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:999px;transition:transform .2s,box-shadow .2s}
.nb-cta-top:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(176,106,124,.35)}

.nb-article{max-width:720px;margin:0 auto;padding:30px 24px 80px}
.nb-eyebrow{font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--rose-dark);margin-bottom:18px}
.nb-h1{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(30px,5vw,46px);line-height:1.12;letter-spacing:.2px;margin:0 0 18px}
.nb-meta{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13.5px;margin-bottom:28px}
.nb-meta b{color:var(--ink);font-weight:600}
.nb-cover{width:100%;border-radius:18px;overflow:hidden;margin-bottom:36px;box-shadow:0 14px 40px rgba(43,34,40,.14)}
.nb-cover img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}

.article-body{font-size:17.5px;line-height:1.75;color:#39312f}
.article-body p{margin:0 0 20px}
.article-body strong{color:var(--ink);font-weight:600}
.article-body h2{
  font-family:'Cormorant Garamond',serif;font-weight:600;font-size:27px;line-height:1.2;
  color:var(--ink);margin:40px 0 14px;letter-spacing:.2px;
}

.article-cta{
  margin:46px 0 10px;padding:30px 28px;border-radius:20px;text-align:center;
  background:linear-gradient(135deg, rgba(201,160,180,.22), rgba(192,133,82,.14));
  border:1px solid rgba(255,255,255,.7);
}
.article-cta h3{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:24px;line-height:1.25;margin:0 0 10px;color:var(--ink)}
.article-cta p{font-size:15px;line-height:1.6;color:#564c4f;margin:0 0 20px}
.article-cta-btn{display:inline-block;background:var(--rose-dark);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 30px;border-radius:999px;transition:transform .2s,box-shadow .2s}
.article-cta-btn:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(176,106,124,.4)}

.nb-faq{margin-top:54px;border-top:1px solid var(--line);padding-top:36px}
.nb-faq h2{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:28px;margin:0 0 22px;color:var(--ink)}
.nb-faq-item{margin-bottom:22px}
.nb-faq-q{font-weight:600;font-size:16px;color:var(--ink);margin:0 0 6px}
.nb-faq-a{font-size:15.5px;line-height:1.65;color:#564c4f;margin:0}

.nb-more{margin-top:56px;border-top:1px solid var(--line);padding-top:34px}
.nb-more-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;margin:0 0 18px;color:var(--ink)}
.nb-more-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.nb-more-card{display:block;text-decoration:none;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;transition:transform .25s,box-shadow .25s}
.nb-more-card:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(43,34,40,.12)}
.nb-more-tag{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--rose-dark);margin-bottom:8px}
.nb-more-h{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:600;line-height:1.25;color:var(--ink)}

.nb-footer{text-align:center;padding:30px 24px 50px;color:var(--muted);font-size:13px}
.nb-footer a{color:var(--rose-dark);text-decoration:none;font-weight:600}

@media(max-width:560px){
  .nb-more-grid{grid-template-columns:1fr}
  .nb-cta-top{display:none}
  .article-body{font-size:17px}
}
`,
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <header className="nb-topbar">
        <a className="nb-logo" href="https://novae-by-omanaia.com">
          Novaé<small>BY OMANAÏA</small>
        </a>
        <div className="nb-top-actions">
          <a className="nb-back" href="https://novae-by-omanaia.com/#blog">
            ← Le blog
          </a>
          <a className="nb-cta-top" href="https://app.novae-by-omanaia.com/signup">
            Essaie 14 jours
          </a>
        </div>
      </header>

      <article className="nb-article">
        <div className="nb-eyebrow">
          {article.tag} · {article.readTime}
        </div>
        <h1 className="nb-h1">{article.title}</h1>
        <div className="nb-meta">
          Par <b>Ness</b>, fondatrice de NOVAÉ · {formatDateFr(article.date)}
        </div>
        <div className="nb-cover">
          {/* image distante volontaire : page marketing publique */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image} alt={article.imageAlt} />
        </div>

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
        />

        <section className="nb-faq">
          <h2>Questions fréquentes</h2>
          {article.faq.map((f, i) => (
            <div className="nb-faq-item" key={i}>
              <p className="nb-faq-q">{f.q}</p>
              <p className="nb-faq-a">{f.a}</p>
            </div>
          ))}
        </section>

        {others.length > 0 && (
          <section className="nb-more">
            <p className="nb-more-title">À lire aussi</p>
            <div className="nb-more-grid">
              {others.map((a) => (
                <a className="nb-more-card" key={a.slug} href={`/blog/${a.slug}`}>
                  <div className="nb-more-tag">
                    {a.tag} · {a.readTime}
                  </div>
                  <div className="nb-more-h">{a.title}</div>
                </a>
              ))}
            </div>
          </section>
        )}
      </article>

      <footer className="nb-footer">
        Tes mots restent à toi. Chiffrés. Personne ne peut les lire, pas même moi.
        <br />
        <a href="https://novae-by-omanaia.com">Retour à NOVAÉ →</a>
      </footer>
    </div>
  )
}