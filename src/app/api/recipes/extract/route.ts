// src/app/api/recipes/extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { canAccess, incrementScanCount } from '@/lib/permissions'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 30

const RECIPE_SCAN_MAX_PER_HOUR = 12
const ANTHROPIC_TIMEOUT_MS = 20_000

const EXTRACTION_PROMPT = `Tu es un assistant qui extrait des recettes depuis des images.
Analyse cette image et extrais la recette au format JSON STRICT suivant :

{
  "title": "string",
  "servings": number | null,
  "ingredients": [
    {"name": "string", "quantity": number | null, "unit": "string | null"}
  ],
  "steps": ["string"],
  "cooking_time_minutes": number | null,
  "category": "string | null",
  "emoji": "string | null"
}

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le JSON, sans préambule, sans markdown, sans \`\`\`
- Si l'image contient PLUSIEURS recettes, extrais SEULEMENT la première
- Si une info n'est pas trouvable, mets null
- "ingredients" : les quantités numériques quand c'est possible, l'unité séparément (g, ml, cuillère à soupe, etc.)
- "steps" : tableau de strings, une étape par string, dans l'ordre
- "emoji" : choisis 1 emoji représentatif (ex: 🥞 pour pancakes, 🍝 pour pâtes)`

async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context, ignore
          }
        },
      },
    }
  )
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [type, token] = header.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null

  return token
}

function getSupabaseBearerClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}


function detectImageMime(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png'
  if (buffer.length >= 6) {
    const head = buffer.subarray(0, 6).toString('ascii')
    if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif'
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

async function recordAiUsage(
  adminClient: any,
  userId: string,
  usage: { input_tokens?: unknown; output_tokens?: unknown } | undefined,
  durationMs: number,
  success: boolean
) {
  try {
    await adminClient.from('ai_usage').insert({
      user_id: userId,
      route: 'recipe_extract',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: Number.isFinite(Number(usage?.input_tokens)) ? Number(usage?.input_tokens) : null,
      output_tokens: Number.isFinite(Number(usage?.output_tokens)) ? Number(usage?.output_tokens) : null,
      duration_ms: durationMs,
      success,
    })
  } catch (error) {
    console.error('[recipe extract] ai usage log failed', error instanceof Error ? error.message : 'unknown')
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. AUTH CHECK
    const bearerToken = getBearerToken(request)
const supabase = bearerToken
  ? getSupabaseBearerClient(bearerToken)
  : await getSupabaseServerClient()

const { data: { user }, error: authError } = bearerToken
  ? await supabase.auth.getUser(bearerToken)
  : await supabase.auth.getUser()

if (authError || !user) {
  console.error('[recipe extract] auth failed', {
    hasBearerToken: Boolean(bearerToken),
    authError: authError?.message,
  })

  return NextResponse.json(
    { error: 'Session expirée. Reconnecte-toi puis réessaie le scan.' },
    { status: 401 }
  )
}

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 })
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const rl = await rateLimit(adminClient, user.id, 'recipe_extract', {
      max: RECIPE_SCAN_MAX_PER_HOUR,
      windowMinutes: 60,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Trop de scans en peu de temps. Réessaie plus tard.', reason: 'rate_limited' },
        { status: 429 }
      )
    }

    // 2. QUOTA CHECK (canAccess)
    const access = await canAccess(supabase as any, 'scan_recipe', user.id)
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason === 'monthly_limit_reached'
            ? `Tu as atteint ta limite mensuelle de scans (${access.quota_max}/mois). Découvre Premium pour des scans illimités.`
            : 'Cette fonctionnalité est réservée aux abonnées Premium.',
          reason: access.reason,
          quota_remaining: access.quota_remaining,
          quota_max: access.quota_max,
        },
        { status: 429 }
      )
    }

    // 3. VALIDATE FILE
    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 5MB).' }, { status: 400 })
    }

    // 4. VALIDATION BINAIRE + APPEL CLAUDE VISION
    const arrayBuffer = await file.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)
    const detectedMime = detectImageMime(imageBuffer)
    if (!detectedMime) {
      return NextResponse.json(
        { error: 'Format image non reconnu. Utilise JPG, PNG, GIF ou WEBP.' },
        { status: 400 }
      )
    }
    const base64 = imageBuffer.toString('base64')

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[recipe extract] ANTHROPIC_API_KEY missing')
      return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS)
    const startedAt = Date.now()
    let anthropicResponse: Response
    try {
      anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: detectedMime, data: base64 } },
                { type: 'text', text: EXTRACTION_PROMPT },
              ],
            },
          ],
        }),
      })
    } catch (error) {
      await recordAiUsage(adminClient, user.id, undefined, Date.now() - startedAt, false)
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'Le scan a pris trop de temps. Réessaie.' }, { status: 504 })
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    if (!anthropicResponse.ok) {
      await recordAiUsage(adminClient, user.id, undefined, Date.now() - startedAt, false)
      console.error('[recipe extract] Anthropic API error', { status: anthropicResponse.status })
      return NextResponse.json({ error: 'AI extraction failed' }, { status: 502 })
    }

    const data = await anthropicResponse.json()
    await recordAiUsage(adminClient, user.id, data?.usage, Date.now() - startedAt, true)
    const rawText = data.content?.[0]?.text || ''

    let recipe
    try {
      const cleaned = rawText.replace(/```json\n?|```/g, '').trim()
      recipe = JSON.parse(cleaned)
    } catch (e) {
      console.error('[recipe extract] JSON parse error', { responseLength: rawText.length })
      return NextResponse.json(
        { error: 'Could not parse recipe from image. Try a clearer image.' },
        { status: 422 }
      )
    }

    // 5. INCREMENT QUOTA (only on success)
    try {
      await incrementScanCount(adminClient as any, user.id)
    } catch (err) {
      console.error('[quota increment failed]', err)
      // Don't fail the request - extraction succeeded
    }

    return NextResponse.json({
      recipe,
      quota_remaining: access.quota_remaining != null ? access.quota_remaining - 1 : null
    })
  } catch (error) {
    console.error('[recipe extract] unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}