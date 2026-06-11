// src/app/api/test-charge-mentale/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const NOVA_DIAGNOSTIC_PROMPT = `Tu es Nova, la coach IA de NOVAÉ. Tu analyses les réponses d'une femme à un test de charge mentale et tu génères un diagnostic personnalisé, profond et bienveillant.

Ton diagnostic doit :
- Nommer exactement ce qu'elle vit (sans minimiser)
- Lui montrer qu'elle est comprise, pas jugée
- Identifier son profil parmi : Surcharge cognitive chronique / Perfectionnisme paralysant / Fatigue de décision / Déconnexion de soi / Épuisement maternel et professionnel
- Lui expliquer ce qui se passe dans son cerveau (vulgarisation neurosciences, accessible)
- Lui montrer concrètement ce que NOVAÉ changerait pour elle
- Terminer par un message d'espoir sincère, pas motivationnel vide

Ton ton : comme une amie qui a vécu la même chose. Pas de "coaching" formaté. Pas de listes à puces. Pas de tirets. Texte fluide, chaleureux, direct. Tutoiement. Maximum 350 mots.

Format de réponse : JSON uniquement, structure :
{
  "profil": "nom du profil (ex: Surcharge cognitive chronique)",
  "score_label": "Léger / Modéré / Élevé / Critique",
  "titre": "une phrase accrocheuse qui résume ce qu'elle vit (max 12 mots)",
  "diagnostic": "le texte complet du diagnostic (250-350 mots)",
  "cta_phrase": "une phrase personnalisée pour l'inviter à essayer NOVAÉ (max 20 mots)"
}`

export async function POST(req: NextRequest) {
  try {
    const { email, totalScore, answers } = await req.json()

    if (!email || !totalScore === undefined || !answers) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Valider email basique
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    // Générer le diagnostic via Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: NOVA_DIAGNOSTIC_PROMPT,
      messages: [{
        role: 'user',
        content: `Score total : ${totalScore}/15\n\nRéponses :\n${answers}\n\nGénère le diagnostic JSON.`
      }]
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    let diagnostic
    try {
      const clean = rawText.replace(/```json|```/g, '').trim()
      diagnostic = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Erreur génération diagnostic' }, { status: 500 })
    }

    // Envoyer l'email via Brevo
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!
      },
      body: JSON.stringify({
        sender: { name: 'Nova de NOVAÉ', email: 'nova@novae-by-omanaia.com' },
        to: [{ email }],
        subject: `💜 Ton diagnostic NOVAÉ : ${diagnostic.profil}`,
        htmlContent: buildEmailHtml(diagnostic, email)
      })
    })

    if (!brevoRes.ok) {
      console.error('Brevo error:', await brevoRes.text())
    }

    // Ajouter à la liste Brevo (liste 9 = free/trial)
    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!
      },
      body: JSON.stringify({
        email,
        listIds: [9],
        updateEnabled: true,
        attributes: {
          SOURCE: 'test_charge_mentale',
          SCORE_CHARGE_MENTALE: totalScore,
          PROFIL_CHARGE: diagnostic.profil,
          SCORE_LABEL: diagnostic.score_label
        }
      })
    })

    return NextResponse.json({ success: true, profil: diagnostic.profil })

  } catch (error) {
    console.error('[test-charge-mentale] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function buildEmailHtml(d: {
  profil: string
  score_label: string
  titre: string
  diagnostic: string
  cta_phrase: string
}, email: string): string {
  const scoreColor = {
    'Léger': '#7BAF8E',
    'Modéré': '#E8B48A',
    'Élevé': '#C4848E',
    'Critique': '#9B5A65'
  }[d.score_label] || '#C4848E'

  // Convertir les sauts de ligne en paragraphes
  const diagnosticHtml = d.diagnostic
    .split('\n')
    .filter(p => p.trim())
    .map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#3A1F24;">${p}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ton diagnostic NOVAÉ</title>
</head>
<body style="margin:0;padding:0;background:#FDF0F0;font-family:'DM Sans',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF0F0;padding:32px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(155,90,101,0.12);">

  <!-- HEADER NOVA -->
  <tr>
    <td style="background:linear-gradient(135deg,#9B5A65,#C4848E);padding:36px 32px;text-align:center;">
      <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#E8D4E0,#C9A0B4);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
        <span style="font-family:Georgia,serif;font-size:26px;font-weight:600;color:#fff;line-height:56px;display:block;">N</span>
      </div>
      <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:6px;">Nova · NOVAÉ</div>
      <div style="font-family:Georgia,serif;font-size:26px;font-style:italic;color:#fff;line-height:1.2;">${d.titre}</div>
    </td>
  </tr>

  <!-- PROFIL BADGE -->
  <tr>
    <td style="padding:28px 32px 0;text-align:center;">
      <div style="display:inline-block;padding:8px 20px;border-radius:999px;background:${scoreColor}22;border:1.5px solid ${scoreColor};margin-bottom:6px;">
        <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${scoreColor};">${d.score_label}</span>
      </div>
      <div style="font-size:13px;color:#8C5A64;margin-top:6px;">Profil détecté : <strong>${d.profil}</strong></div>
    </td>
  </tr>

  <!-- DIAGNOSTIC -->
  <tr>
    <td style="padding:24px 32px;">
      <div style="border-left:3px solid ${scoreColor};padding-left:18px;margin-bottom:20px;">
        <div style="font-family:Georgia,serif;font-size:13px;font-style:italic;color:#8C5A64;margin-bottom:4px;">Ton diagnostic par Nova</div>
      </div>
      ${diagnosticHtml}
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:0 32px 36px;text-align:center;">
      <div style="background:linear-gradient(135deg,#F2D4D4,#E8C4C8);border-radius:16px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:17px;font-style:italic;color:#3A1F24;">${d.cta_phrase}</p>
        <a href="https://app.novae-by-omanaia.com?utm_source=email&utm_campaign=test_charge_mentale" style="display:inline-block;padding:14px 32px;border-radius:999px;background:linear-gradient(135deg,#C4848E,#9B5A65);color:#fff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.4px;box-shadow:0 8px 22px rgba(155,90,101,.3);">✦ Essaie NOVAÉ 14 jours gratuits</a>
      </div>
      <p style="font-size:11px;color:#B08890;margin:0;">Pas de carte bancaire · Annulable en un clic · 7,90€/mois après</p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#FDF0F0;padding:20px 32px;text-align:center;border-top:1px solid #F2D4D4;">
      <p style="margin:0 0 6px;font-size:11px;color:#B08890;">© 2026 OMANAÏA · SIREN 100305218</p>
      <p style="margin:0;font-size:11px;color:#B08890;">
        <a href="https://app.novae-by-omanaia.com/confidentialite" style="color:#C4848E;text-decoration:none;">Politique de confidentialité</a>
        &nbsp;·&nbsp;
        <a href="https://app.novae-by-omanaia.com/unsubscribe?email=${encodeURIComponent(email)}" style="color:#C4848E;text-decoration:none;">Se désabonner</a>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`
}