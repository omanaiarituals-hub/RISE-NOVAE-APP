import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { BADGES, BADGES_BY_ID } from '@/lib/badges';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function BadgesPage() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: userData } = await supabaseAuth.auth.getUser();
  if (!userData.user) redirect('/login');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: earned } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', userData.user.id);

  const earnedMap = new Map<string, string>(
    (earned ?? []).map((b) => [b.badge_id, b.earned_at])
  );

  const grouped = {
    presence: BADGES.filter((b) => b.category === 'presence'),
    programme: BADGES.filter((b) => b.category === 'programme'),
    engagement: BADGES.filter((b) => b.category === 'engagement'),
  };

  return (
    <main
      className="min-h-screen px-6 py-12"
      style={{ background: 'linear-gradient(180deg, #FAF6F0 0%, #F4ECDF 100%)' }}
    >
      <div className="max-w-md mx-auto">
        <h1
          className="text-3xl text-center mb-2"
          style={{ color: '#2D2522', fontFamily: 'Georgia, serif' }}
        >
          Mes badges
        </h1>
        <p
          className="text-xs text-center uppercase mb-12"
          style={{ color: '#C4956A', letterSpacing: '0.3em' }}
        >
          {earnedMap.size} sur {BADGES.length}
        </p>

        <Section title="Présence" badges={grouped.presence} earnedMap={earnedMap} />
        <Section title="Programme" badges={grouped.programme} earnedMap={earnedMap} />
        <Section title="Communauté" badges={grouped.engagement} earnedMap={earnedMap} />
      </div>
    </main>
  );
}

function Section({
  title,
  badges,
  earnedMap,
}: {
  title: string;
  badges: typeof BADGES;
  earnedMap: Map<string, string>;
}) {
  return (
    <section className="mb-10">
      <h2
        className="text-xs uppercase mb-4"
        style={{ color: '#8B7355', letterSpacing: '0.3em' }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {badges.map((b) => {
          const earned = earnedMap.has(b.id);
          return (
            <div
              key={b.id}
              className="flex flex-col items-center text-center p-3 rounded-2xl"
              style={{
                backgroundColor: earned ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                opacity: earned ? 1 : 0.5,
                boxShadow: earned ? '0 4px 16px rgba(196,149,106,0.15)' : 'none',
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                style={{
                  background: earned
                    ? 'radial-gradient(circle, #E8C9A0 0%, #C4956A 100%)'
                    : '#E5DFD4',
                }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    color: earned ? '#FAF6F0' : '#A89F95',
                  }}
                >
                  {b.glyph}
                </span>
              </div>
              <p
                className="text-[10px]"
                style={{
                  color: earned ? '#2D2522' : '#A89F95',
                  fontFamily: 'Georgia, serif',
                }}
              >
                {b.name}
              </p>
              <p
                className="text-[9px] mt-1"
                style={{ color: earned ? '#8B7355' : '#A89F95' }}
              >
                {earned ? '✓' : b.criterion}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}