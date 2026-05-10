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
        setMessage("Tu es déjà passée aujourd'hui ✨");
      } else if (data.wasReset) {
        setMessage('Ta flamme se rallume. Bienvenue à nouveau.');
        setPulse(true);
      } else if (data.usedFreeze) {
        setMessage('Jour de répit utilisé.');
      } else {
        setMessage('Ta présence est notée ✨');
        setPulse(true);
      }
      setTimeout(() => setPulse(false), 1200);
      setTimeout(() => setMessage(null), 4000);

      if (data.newlyEarnedBadges && data.newlyEarnedBadges.length > 0) {
        const queue = [...data.newlyEarnedBadges];
        setUnlockedBadgeId(queue.shift()!);
        setUnlockedQueue(queue);
      }
    } catch {
      setMessage('Réessaie ?');
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

  if (loading || !state) return null;

  const isLit = state.level > 0;
  const displayText = message ?? LEVEL_COPY[state.level];

  return (
    <>
      <div
        style={{
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          borderRadius: 16,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 4px 12px rgba(139, 90, 60, 0.06)',
        }}
      >
        {/* Petite flamme à gauche */}
        <div style={{ flexShrink: 0 }}>
          <CompactFlame level={state.level} pulse={pulse} />
        </div>

        {/* Stats au centre */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: '#8b5a3c',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              marginBottom: 2,
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <span>Ma flamme</span>
            <span style={{ color: '#c4956a', opacity: 0.6 }}>·</span>
            <span style={{ color: isLit ? '#3d2618' : '#a08770', letterSpacing: '0.05em' }}>
              {state.current} {state.current <= 1 ? 'jour' : 'jours'}
            </span>
            {state.freezesRemaining > 0 && isLit && (
              <span style={{ color: '#c4956a', fontSize: 8, opacity: 0.7 }}>
                · {state.freezesRemaining} répit
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#6b5340',
              fontStyle: 'italic',
              fontFamily: "'Cormorant Garamond', serif",
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayText}
          </div>
        </div>

        {/* Bouton à droite */}
        <button
          onClick={handleCheckIn}
          disabled={submitting}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #c4956a, #a07850)',
            color: '#faf6f0',
            fontSize: 9.5,
            letterSpacing: '0.15em',
            fontWeight: 700,
            textTransform: 'uppercase',
            border: 'none',
            cursor: submitting ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(196,149,106,0.3)',
            opacity: submitting ? 0.6 : 1,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {submitting ? '...' : isLit ? 'Je suis là' : 'Rallumer'}
        </button>
      </div>

      {unlockedBadgeId && (
        <BadgeUnlockModal badgeId={unlockedBadgeId} onClose={handleModalClose} />
      )}
    </>
  );
}

function CompactFlame({
  level,
  pulse,
}: {
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  pulse: boolean;
}) {
  const size = 30;
  const intensity = level / 7;
  const showGlow = level >= 3;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{
          filter: showGlow ? `drop-shadow(0 0 ${3 + level}px rgba(196,149,106,0.5))` : 'none',
          animation: level > 0 ? `flicker ${1.6 - intensity * 0.4}s ease-in-out infinite` : 'none',
          opacity: level === 0 ? 0.3 : 1,
          transform: pulse ? 'scale(1.2)' : 'scale(1)',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <defs>
          <linearGradient id="cflameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#a57850" />
            <stop offset="50%" stopColor="#c4956a" />
            <stop offset="100%" stopColor="#e8c9a0" />
          </linearGradient>
          <linearGradient id="cflameInner" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#d4af6a" />
            <stop offset="100%" stopColor="#fff5e0" />
          </linearGradient>
        </defs>
        <path
          d="M32 60 C18 56, 14 44, 18 34 C20 28, 24 24, 24 18 C24 12, 28 8, 32 4 C32 12, 38 16, 42 24 C46 32, 48 40, 46 48 C44 56, 38 60, 32 60 Z"
          fill="url(#cflameGrad)"
        />
        {level >= 2 && (
          <path
            d="M32 54 C24 50, 22 42, 26 34 C28 30, 30 26, 32 20 C32 26, 36 30, 38 36 C40 42, 38 48, 36 52 C34 54, 32 54, 32 54 Z"
            fill="url(#cflameInner)"
            style={{ animation: 'flickerInner 1.2s ease-in-out infinite alternate' }}
          />
        )}
      </svg>

      <style jsx>{`
        @keyframes flicker {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50% { transform: scaleY(1.05) translateY(-1px); }
        }
        @keyframes flickerInner {
          0% { opacity: 0.7; transform: scaleY(0.95); }
          100% { opacity: 1; transform: scaleY(1.05); }
        }
      `}</style>
    </div>
  );
}