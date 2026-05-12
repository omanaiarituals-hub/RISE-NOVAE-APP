'use client';

import { useSearchParams } from 'next/navigation';

const APP_URL = 'https://app.novae-by-omanaia.com';

export default function RetourContent() {
  const searchParams = useSearchParams();
  const prenom = searchParams.get('p')?.trim() || '';

  // URL absolue vers la communaute sur le sous-domaine app
  // Le pseudo est transmis pour personnaliser l'accueil cote app
  const communityUrl = prenom
    ? `${APP_URL}/community?p=${encodeURIComponent(prenom)}`
    : `${APP_URL}/community`;

  return (
    <main className="min-h-screen bg-[#F5F0EA] flex flex-col items-center justify-center px-6 py-16">
      <div className="text-center max-w-md w-full">
        {/* Logo */}
        <div className="mb-12">
          <h1 className="font-serif text-4xl tracking-[0.25em] text-[#2A2520]">
            NOV<span className="text-[#C4956A]">A</span>É
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-[#7A6850] mt-2 uppercase">
            by Omanaïa
          </p>
        </div>

        {/* Separateur */}
        <div className="flex items-center justify-center gap-3 mb-12 opacity-50">
          <span className="h-px w-16 bg-[#C4956A]" />
          <span className="text-[#C4956A] text-xs">*</span>
          <span className="h-px w-16 bg-[#C4956A]" />
        </div>

        {/* Message d'accueil */}
        <h2 className="font-serif text-2xl text-[#2A2520] leading-relaxed mb-2">
          Heureuse de te retrouver,
        </h2>
        {prenom ? (
          <p className="font-serif italic text-2xl text-[#C4956A] mb-10">
            {prenom}.
          </p>
        ) : (
          <div className="mb-10" />
        )}

        <p className="text-[#3D2618] text-base leading-[1.8] mb-12 max-w-sm mx-auto">
          Tu reviens chez toi.
          <br />
          La communauté NOVAÉ t&apos;attend, et il s&apos;est passé tant de choses depuis ton inscription.
        </p>

        {/* CTA - URL absolue vers le sous-domaine app */}
        <a
          href={communityUrl}
          className="inline-block bg-[#C4956A] hover:bg-[#B8855A] text-white px-12 py-4 rounded-full tracking-[0.15em] text-sm font-medium transition-colors duration-200 shadow-sm"
        >
          OUVRIR NOVAÉ
        </a>
      </div>
    </main>
  );
}