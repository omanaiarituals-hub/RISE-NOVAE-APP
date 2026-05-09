const BREVO_API = 'https://api.brevo.com/v3'

export async function sendBrevoEmail({
  to,
  templateId,
  params,
}: {
  to: { email: string; name?: string }
  templateId: number
  params?: Record<string, any>
}) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.error('[brevo] BREVO_API_KEY manquante')
    return { success: false, error: 'API key missing' }
  }

  try {
    const response = await fetch(`${BREVO_API}/smtp/email`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: 'contact@novae-by-omanaia.com', name: 'NOVAÉ' },
        to: [to],
        templateId,
        params,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[brevo] send failed', response.status, text)
      return { success: false, error: text, status: response.status }
    }

    const data = await response.json()
    return { success: true, messageId: data.messageId }
  } catch (err) {
    console.error('[brevo] send error', err)
    return { success: false, error: String(err) }
  }
}

export async function addBrevoContact({
  email,
  attributes,
  listIds,
}: {
  email: string
  attributes?: Record<string, any>
  listIds?: number[]
}) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { success: false, error: 'API key missing' }

  try {
    const response = await fetch(`${BREVO_API}/contacts`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds,
        updateEnabled: true,
      }),
    })

    if (!response.ok && response.status !== 400) {
      const text = await response.text()
      console.error('[brevo] add contact failed', response.status, text)
      return { success: false, error: text }
    }

    return { success: true }
  } catch (err) {
    console.error('[brevo] contact error', err)
    return { success: false, error: String(err) }
  }
}