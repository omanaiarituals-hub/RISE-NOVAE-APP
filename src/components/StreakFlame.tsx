'use client';

import { useEffect, useState } from 'react';
import BadgeUnlockModal from './BadgeUnlockModal';

type StreakState = {
  current: number;
  longest: number;
  freezesRemaining: number;
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

const LEVEL_COPY: Record<number, string> = {
  0: 'Ta flamme attend que tu la rallumes.',
  1: 'Première étincelle.',
  2: "Une lueur s'installe.",
  3: 'La constance prend racine.',
  4: 'Ta flamme est ancrée.',
  5: 'Elle rayonne.',
  6: 'Une présence profonde.',
  7: 'Renaissance.',
};

export default function StreakFlame() {
  const [state, setState] = useState<StreakState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unlockedBadgeId, setUnlockedBadgeId] = useState<string | null>(null);
  const [unlockedQueue, setUnlockedQueue] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/streak', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setState(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCheckIn() {
    if (submitting || !state) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/streak', { method: 'POST', credentials: 'include' });
      const data = await res.json();

      setState({
        current: data.current,
        longest: data.longest,
        freezesRemaining: data.freezesRemaining,
        level: data.level,
      });

      if (data.alreadyCheckedInToday) {
        setMessage('Tu es déjà passée aujourd\'hui ✨');
      } else if (data.wasReset) {
        setMessage('Ta flamme se rallume. Bienvenue à nouveau.');
        setPulse(true);
      } else if (data.usedFreeze) {
        setMessage('Jour de répit utilisé — ta flamme veille toujours.');
      } else {
        setMessage('Ta présence est notée ✨');
        setPulse(true);
      }
      setTimeout(() => setPulse(false), 1200);
      setTimeout(() => setMessage(null), 4000);

      // Empiler les badges nouvellement débloqués pour les afficher un par un
      if (data.newlyEarnedBadges && data.newlyEarnedBadges.length > 0) {
        const queue = [...data.newlyEarnedBadges];
        setUnlockedBadgeId(queue.shift()!);
        setUnlockedQueue(queue);
      }
    } catch {
      setMessage('Une erreur est survenue. Réessaie ?');
    } finally {
      setSubmitting(false);
    }
  }

  function handleModalClose() {
    if (unlockedQueue.length > 0) {
      const [next, ...rest] = unlockedQueue;
      setUnlockedBadgeId(next);
      setUnlockedQueue(rest);
    } else {
      setUnlockedBadgeId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#C4956A' }} />
      </div>
    );
  }

  if (!state) return null;

  return (
    <>
      <div className="flex flex-col items-center text-center py-4">
        <div className="relative mb-2">
          <Flame level={state.level} pulse={pulse} />
        </div>

        <div
          className="text-3xl font-light"
          style={{
            color: state.level === 0 ? '#A89F95' : '#2D2522',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {state.current}
          <span className="text-sm ml-1" style={{ color: '#C4956A', letterSpacing: '0.15em' }}>
            {state.current <= 1 ? 'jour' : 'jours'}
          </span>
        </div>

        <p className="text-xs italic mt-1 mb-3" style={{ color: '#8B7355' }}>
          {LEVEL_COPY[state.level]}
        </p>

        {state.freezesRemaining > 0 && state.level > 0 && (
          <p
            className="text-[10px] uppercase mb-3"
            style={{ color: '#C4956A', opacity: 0.7, letterSpacing: '0.2em' }}
          >
            ✦ {state.freezesRemaining} jour de répit disponible
          </p>
        )}

        <button
          onClick={handleCheckIn}
          disabled={submitting}
          className="px-7 py-3 rounded-full text-xs uppercase transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{
            backgroundColor: '#C4956A',
            color: '#FAF6F0',
            letterSpacing: '0.2em',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 4px 16px rgba(196, 149, 106, 0.3)',
          }}
        >
          {submitting ? '...' : state.level === 0 ? 'Rallumer ma flamme' : 'Je suis là aujourd\'hui'}
        </button>

        {message && (
          <p className="text-xs mt-3 animate-fadeIn" style={{ color: '#5A4A3A' }}>
            {message}
          </p>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        `}</style>
      </div>

      {unlockedBadgeId && (
        <BadgeUnlockModal badgeId={unlockedBadgeId} onClose={handleModalClose} />
      )}
    </>
  );
}

function Flame({
  level,
  pulse,
}: {
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  pulse: boolean;
}) {
  const size = 40 + level * 8;
  const showGlow = level >= 4;
  const showHalo = level >= 5;
  const showSparks = level >= 6;
  const intensity = level / 7;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size + 60, height: size + 30 }}
    >
      {showHalo && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(212,175,106,${0.25 + intensity * 0.2}) 0%, transparent 60%)`,
            animation: 'haloPulse 3s ease-in-out infinite',
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{
          filter: showGlow ? `drop-shadow(0 0 ${6 + level * 2}px rgba(196,149,106,0.55))` : 'none',
          animation: level > 0 ? `flicker ${1.6 - intensity * 0.4}s ease-in-out infinite` : 'none',
          opacity: level === 0 ? 0.35 : 1,
          transform: pulse ? 'scale(1.15)' : 'scale(1)',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <defs>
          <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#A57850" />
            <stop offset="50%" stopColor="#C4956A" />
            <stop offset="100%" stopColor="#E8C9A0" />
          </linearGradient>
          <linearGradient id="flameInner" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#D4AF6A" />
            <stop offset="100%" stopColor="#FFF5E0" />
          </linearGradient>
        </defs>
        <path
          d="M32 60 C18 56, 14 44, 18 34 C20 28, 24 24, 24 18 C24 12, 28 8, 32 4 C32 12, 38 16, 42 24 C46 32, 48 40, 46 48 C44 56, 38 60, 32 60 Z"
          fill="url(#flameGrad)"
        />
        {level >= 2 && (
          <path
            d="M32 54 C24 50, 22 42, 26 34 C28 30, 30 26, 32 20 C32 26, 36 30, 38 36 C40 42, 38 48, 36 52 C34 54, 32 54, 32 54 Z"
            fill="url(#flameInner)"
            style={{ animation: 'flickerInner 1.2s ease-in-out infinite alternate' }}
          />
        )}
      </svg>
      {showSparks && (
        <>
          <span className="spark spark-1" />
          <span className="spark spark-2" />
          <span className="spark spark-3" />
        </>
      )}
      <style jsx>{`
        @keyframes flicker {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50% { transform: scaleY(1.05) translateY(-1px); }
        }
        @keyframes flickerInner {
          0% { opacity: 0.7; transform: scaleY(0.95); }
          100% { opacity: 1; transform: scaleY(1.05); }
        }
        @keyframes haloPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes floatSpark {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-30px) scale(0.4); opacity: 0; }
        }
        .spark {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #D4AF6A;
          border-radius: 50%;
          box-shadow: 0 0 6px #C4956A;
        }
        .spark-1 { left: 30%; top: 40%; animation: floatSpark 2.4s ease-out infinite; }
        .spark-2 { left: 55%; top: 50%; animation: floatSpark 2.4s ease-out 0.8s infinite; }
        .spark-3 { left: 70%; top: 30%; animation: floatSpark 2.4s ease-out 1.6s infinite; }
      `}</style>
    </div>
  );
}