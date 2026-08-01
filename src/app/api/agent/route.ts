import { NextResponse } from 'next/server'

// Route héritée neutralisée le 2026-08-01 (Lot 0).
// L'ancienne implémentation (971 lignes, service role) n'avait plus aucun
// appelant côté client. Elle reste dans l'historique git si besoin.
// Toute la logique agent vit désormais dans /api/nova/*.

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    { error: 'gone', message: 'Cette route a été retirée. Utiliser /api/nova.' },
    { status: 410 }
  )
}
