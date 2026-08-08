'use client'

import Link from 'next/link'
import Navigation from '@/components/Navigation'
import PremiumIcon from '@/components/ui/PremiumIcon'

export default function FinancesPage() {
  return (
    <main className="finances-page">
      <section className="finances-shell">
        <Link href="/" className="back-link">
          <PremiumIcon name="chevron" width={16} height={16} />
          <span>Retour accueil</span>
        </Link>

        <div className="coming-card">
          <span className="icon-tile" aria-hidden="true">
            <PremiumIcon name="wallet" width={34} height={34} />
          </span>

          <p className="eyebrow">NOVAÉ</p>
          <h1>Finances</h1>
          <p className="subtitle">Module bientôt disponible</p>
          <p className="description">
            Cet espace est en préparation. Il sera intégré à NOVAÉ sans modifier
            tes autres modules.
          </p>

          <Link href="/" className="home-button">
            Retour à l’accueil
          </Link>
        </div>
      </section>

      <Navigation />

      <style jsx>{`
        .finances-page {
          min-height: 100dvh;
          padding-bottom: 110px;
          color: var(--novae-text-main);
          background: var(--novae-background);
          font-family: var(--novae-font-body);
        }

        .finances-shell {
          width: min(100% - 32px, 920px);
          margin: 0 auto;
          padding: 34px 0 48px;
        }

        .back-link {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 22px;
          color: var(--novae-text-main);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .back-link :global(svg) {
          transform: rotate(180deg);
        }

        .coming-card {
          display: grid;
          justify-items: center;
          padding: clamp(34px, 7vw, 72px) 24px;
          text-align: center;
          background: color-mix(
            in srgb,
            var(--novae-surface) 96%,
            transparent
          );
          border: 1px solid var(--novae-border);
          border-radius: 28px;
          box-shadow: 0 18px 48px var(--novae-shadow);
        }

        .icon-tile {
          display: inline-flex;
          width: 78px;
          height: 78px;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: var(--novae-metal);
          background: linear-gradient(
            145deg,
            var(--novae-primary),
            var(--novae-hero-end)
          );
          border: 1px solid var(--novae-metal);
          border-radius: 22px;
          box-shadow: 0 12px 30px var(--novae-shadow);
        }

        .eyebrow {
          margin: 0 0 7px;
          color: var(--novae-metal);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        h1 {
          margin: 0;
          font-family: var(--novae-font-title);
          font-size: clamp(42px, 7vw, 70px);
          font-weight: 500;
          line-height: 1;
        }

        .subtitle {
          margin: 18px 0 0;
          color: var(--novae-primary);
          font-family: var(--novae-font-title);
          font-size: clamp(24px, 4vw, 34px);
        }

        .description {
          max-width: 540px;
          margin: 16px auto 0;
          color: var(--novae-text-muted);
          font-size: 15px;
          line-height: 1.65;
        }

        .home-button {
          display: inline-flex;
          min-height: 48px;
          align-items: center;
          justify-content: center;
          margin-top: 28px;
          padding: 0 22px;
          color: var(--novae-metal);
          font-weight: 800;
          text-decoration: none;
          background: var(--novae-primary);
          border: 1px solid var(--novae-metal);
          border-radius: 999px;
        }

        @media (max-width: 520px) {
          .finances-shell {
            width: min(100% - 24px, 920px);
            padding-top: 22px;
          }

          .coming-card {
            padding: 40px 20px;
            border-radius: 24px;
          }
        }
      `}</style>
    </main>
  )
}
