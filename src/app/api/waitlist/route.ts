import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BREVO_LIST_ID = 8
const BREVO_CONFIRMATION_TEMPLATE_ID = 49

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
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

        if (brevoStatus === 'synced') {
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
      alreadyRegistered: false,
    })
  } catch (error) {
    console.error('[waitlist] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Réessaie dans un instant.' },
      { status: 500 }
    )
  }
}
