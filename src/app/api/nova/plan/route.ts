import { NextRequest } from 'next/server'
import { handleNovaPlanRequest } from '@/lib/nova-ai/server/plan-handler'

export const runtime = 'nodejs'
export const preferredRegion = 'dub1'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  return handleNovaPlanRequest(request)
}
