import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BREVO_LIST_ID = 8
const BREVO_CONFIRMATION_TEMPLATE_ID = 49
const WAITLIST_IP_MAX_PER_HOUR = 10
const WAITLIST_EMAIL_MAX_PER_DAY = 3

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}



function requestIp(req: NextRequest): string {
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for')
  const forwarded = vercelForwarded || req.headers.get('x-forwarded-for') || ''
  const parts = forwarded.split(',').map((value) => value.trim()).filter(Boolean)
  return parts[parts.length - 1] || 'unknown'
}

function privacyKey(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function consumePublicLimit(
  supabase: any,
  key: string,
  action: string,
  max: number,
  windowMinutes: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc('consume_public_request_rate_limit', {
    p_key: key,
    p_action: action,
    p_max: max,
    p_window_minutes: windowMinutes,
  })

  if (error) {
    console.error('[waitlist] rate limit unavailable', { action, message: error.message })
    return false
  }

  return data === true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = normalizeEmail(body?.email)
    const source =
      typeof body?.source === 'string' && body.source.trim()
        ? body.source.trim().slice(0, 80)
        : 'landing'
    const consentMarketing = body?.consentMarketing !== false

    if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: 'Adresse e-mail invalide.' },
        { status: 400 }
      )
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[waitlist] Supabase server configuration missing')
      return NextResponse.json(
        { error: 'Service temporairement indisponible.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ipAllowed = await consumePublicLimit(
      supabase,
      privacyKey(`ip:${requestIp(req)}`),
      'waitlist_ip',
      WAITLIST_IP_MAX_PER_HOUR,
      60
    )
    if (!ipAllowed) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessaie un peu plus tard.' },
        { status: 429 }
      )
    }

    const emailAllowed = await consumePublicLimit(
      supabase,
      privacyKey(`email:${email}`),
      'waitlist_email',
      WAITLIST_EMAIL_MAX_PER_DAY,
      24 * 60
    )
    if (!emailAllowed) {
      return NextResponse.json(
        { error: 'Cette adresse a déjà été enregistrée récemment.' },
        { status: 429 }
      )
    }

    const { data: previousSignup } = await supabase
      .from('waitlist_signups')
      .select('confirmation_sent_at')
      .eq('email_normalized', email)
      .maybeSingle()

    const confirmationAlreadyRecent = previousSignup?.confirmation_sent_at
      ? Date.now() - new Date(previousSignup.confirmation_sent_at).getTime() < 24 * 60 * 60 * 1000
      : false

    const { error: saveError } = await supabase
      .from('waitlist_signups')
      .upsert(
        {
          email,
          email_normalized: email,
          source,
          consent_marketing: consentMarketing,
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'email_normalized',
          ignoreDuplicates: false,
        }
      )

    if (saveError) {
      console.error('[waitlist] Supabase save error:', saveError)
      return NextResponse.json(
        { error: 'Impossible d’enregistrer ton adresse pour le moment.' },
        { status: 500 }
      )
    }

    let brevoStatus = 'skipped'

    if (process.env.BREVO_API_KEY) {
      let confirmationSentAt: string | null = null

      try {
        const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            email,
            attributes: {
              SOURCE: source,
              CONSENTEMENT: consentMarketing ? 'oui' : 'non',
            },
            listIds: [BREVO_LIST_ID],
            updateEnabled: true,
          }),
        })

        brevoStatus =
          brevoResponse.ok || brevoResponse.status === 204 ? 'synced' : 'failed'

        if (brevoStatus === 'failed') {
          console.error(
            '[waitlist] Brevo contact error:',
            brevoResponse.status,
            await brevoResponse.text()
          )
        }

        if (brevoStatus === 'synced' && !confirmationAlreadyRecent) {
          const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': process.env.BREVO_API_KEY,
            },
            body: JSON.stringify({
              to: [{ email }],
              templateId: BREVO_CONFIRMATION_TEMPLATE_ID,
            }),
          })

          if (emailResponse.ok) {
            confirmationSentAt = new Date().toISOString()
          } else {
            console.error(
              '[waitlist] Brevo confirmation email error:',
              emailResponse.status,
              await emailResponse.text()
            )
          }
        }
      } catch (error) {
        brevoStatus = 'failed'
        console.error('[waitlist] Brevo request error:', error)
      }

      await supabase
        .from('waitlist_signups')
        .update({
          brevo_status: brevoStatus,
          confirmation_sent_at: confirmationSentAt,
        })
        .eq('email_normalized', email)
    }

    return NextResponse.json({
      success: true,
      message: 'Ton adresse est bien enregistrée.',
      alreadyRegistered: Boolean(previousSignup),
    })
  } catch (error) {
    console.error('[waitlist] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Réessaie dans un instant.' },
      { status: 500 }
    )
  }
}
