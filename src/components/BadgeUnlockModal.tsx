'use client';

import { useState } from 'react';
import { BADGES_BY_ID } from '@/lib/badges';

export default function BadgeUnlockModal({
  badgeId,
  onClose,
}: {
  badgeId: string;
  onClose: () => void;
}) {
  const def = BADGES_BY_ID[badgeId];
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!def) return null;

  async function handleShare() {
    setSharing(true);
    setError(null);
    try {
      const res = await fetch('/api/badges', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur de partage');
      } else {
        setShared(true);
        setTimeout(onClose, 1500);
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(45, 37, 34, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl p-8 text-center"
        style={{
          background: 'linear-gradient(180deg, #FAF6F0 0%, #F1E9DC 100%)',
          boxShadow: '0 20px 60px rgba(196, 149, 106, 0.3)',
        }}
      >
        <p
          className="text-[10px] uppercase mb-4"
          style={{ color: '#C4956A', letterSpacing: '0.4em' }}
        >
          Tu viens de débloquer
        </p>

        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
          style={{
            background: 'radial-gradient(circle, #E8C9A0 0%, #C4956A 100%)',
            boxShadow: '0 0 30px rgba(196, 149, 106, 0.6)',
            animation: 'badgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <span style={{ fontSize: '34px', color: '#FAF6F0' }}>{def.glyph}</span>
        </div>

        <h2
          className="text-2xl mb-2"
          style={{ color: '#2D2522', fontFamily: 'Georgia, serif' }}
        >
          {def.name}
        </h2>
        <p
          className="text-sm italic mb-1"
          style={{ color: '#8B7355' }}
        >
          {def.meaning}
        </p>
        <p
          className="text-xs mb-6"
          style={{ color: '#5A4A3A' }}
        >
          {def.description}
        </p>

        {!shared ? (
          <>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-3 rounded-full text-xs uppercase mb-3 transition-all active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: '#C4956A',
                color: '#FAF6F0',
                letterSpacing: '0.2em',
              }}
            >
              {sharing ? '...' : 'Partager dans la communauté'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs uppercase"
              style={{ color: '#8B7355', letterSpacing: '0.2em' }}
            >
              Plus tard
            </button>
          </>
        ) : (
          <p className="text-sm" style={{ color: '#A57850' }}>
            ✨ Partagé dans la communauté
          </p>
        )}

        {error && (
          <p className="text-xs mt-3" style={{ color: '#A04040' }}>
            {error}
          </p>
        )}

        <style jsx>{`
          @keyframes badgePop {
            0% { transform: scale(0.4); opacity: 0; }
            70% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}