'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function RetourContent() {
  const searchParams = useSearchParams();
  const pseudo = (searchParams.get('p') || '').trim();

  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari standalone flag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(window as any).MSStream;

    setIsStandalone(standalone);
    setIsIOS(ios);

    // Si elle est déjà dans la PWA installée, on l'envoie direct dans l'app
    if (standalone) {
      window.location.replace('/community');
    }
  }, []);

  // Pendant la redirection (PWA installée), on ne flashe rien
  if (isStandalone) return null;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{
        background:
          'linear-gradient(180deg, #FAF6F0 0%, #F4ECDF 60%, #EFE3D0 100%)',
      }}
    >
      <div className="max-w-md w-full text-center">
        {/* Wordmark */}
        <div className="mb-12">
          <h1
            className="text-4xl font-light"
            style={{
              color: '#2D2522',
              letterSpacing: '0.3em',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            NOVAÉ
          </h1>
          <p
            className="text-[10px] mt-1 uppercase"
            style={{
              color: '#C4956A',
              letterSpacing: '0.45em',
            }}
          >
            by Omanaïa
          </p>
        </div>

        {/* Décor */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span
            className="block h-px w-12"
            style={{ backgroundColor: '#C4956A', opacity: 0.4 }}
          />
          <span style={{ color: '#C4956A', fontSize: '12px' }}>✦</span>
          <span
            className="block h-px w-12"
            style={{ backgroundColor: '#C4956A', opacity: 0.4 }}
          />
        </div>

        {/* Message */}
        <h2
          className="text-2xl leading-snug mb-6"
          style={{
            color: '#2D2522',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {pseudo ? (
            <>
              Heureuse de te retrouver,
              <br />
              <em style={{ color: '#A57850', fontStyle: 'italic' }}>
                {pseudo}
              </em>
              .
            </>
          ) : (
            <>Heureuse de te retrouver.</>
          )}
        </h2>

        <p
          className="text-base leading-relaxed mb-12"
          style={{
            color: '#5A4A3A',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Tu reviens chez toi.
          <br />
          La communauté NOVAÉ t'attend, et il s'est passé tant de
          choses depuis ton inscription.
        </p>

        {/* CTA principal */}
        <Link
          href="/community"
          className="inline-block px-10 py-4 rounded-full text-sm uppercase transition-all hover:opacity-90 active:scale-95"
          style={{
            backgroundColor: '#C4956A',
            color: '#FAF6F0',
            letterSpacing: '0.2em',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 6px 24px rgba(196, 149, 106, 0.35)',
            textDecoration: 'none',
          }}
        >
          Ouvrir NOVAÉ
        </Link>

        {/* Astuce iOS si pertinent */}
        {isIOS && (
          <p
            className="text-xs italic mt-10 leading-relaxed"
            style={{
              color: '#8B7355',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Astuce&nbsp;: si tu as installé NOVAÉ sur ton iPhone,
            <br />
            tu peux aussi l'ouvrir depuis l'icône de ton écran d'accueil.
          </p>
        )}

        {/* Signature */}
        <p
          className="text-[10px] uppercase mt-16"
          style={{
            color: '#C4956A',
            letterSpacing: '0.35em',
            opacity: 0.7,
          }}
        >
          Avec douceur — Ness
        </p>
      </div>
    </main>
  );
}