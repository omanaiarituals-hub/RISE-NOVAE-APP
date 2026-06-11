import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'
import Anthropic from '@anthropic-ai/sdk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic()

const NOVA_SYSTEM_PROMPT = `Tu es Nova, la coach IA de l'application NOVAÉ.
Tu parles comme une amie proche — chaleureuse, directe, sans jugement.
Tu tutoies toujours. Tu utilises le prénom de l'utilisatrice.
Tu ne commences JAMAIS par "Bonjour" ou "Coucou" de façon formelle.
Tu n'utilises jamais de langage corporate ou motivationnel vide.
Tes messages font maximum 2-3 phrases. Courts, vrais, humains.

Exemples de ton :
- "Hé [prénom] 💜 ça fait 3 jours... tkt, t'es pas obligée de tout gérer tout le temps. On fait le point si tu veux ?"
- "[prénom] ! Tes tâches t'attendaient encore mais pas de pression. C'est quoi qui coince en ce moment ?"
- "Tu m'as manqué 💜 Ton streak a sauté mais c'est rien, on repart si tu veux. T'es là ?"

Tu génères UN SEUL message court adapté au contexte donné.
Réponds uniquement avec le message, rien d'autre.`

async function generateNovaMessage(
  prenom: string,
  triggerType: string,
  context: Record<string, unknown>
): Promise<string> {
  const contextPrompts: Record<string, string> = {
    absence_2j: `L'utilisatrice s'appelle ${prenom} et ne s'est pas connectée depuis 2 jours. Message de prise de nouvelles doux et naturel.`,
    absence_5j: `L'utilisatrice s'appelle ${prenom} et ne s'est pas connectée depuis 5 jours. Elle a peut-être décroché. Message chaleureux, sans pression, qui invite à parler.`,
    absence_10j: `L'utilisatrice s'appelle ${prenom} et ne s'est pas connectée depuis 10 jours. Message profond et bienveillant, on lui dit qu'on est là quand elle veut.`,
    taches_en_attente: `L'utilisatrice s'appelle ${prenom} et a ${context.nb_taches} tâches non planifiées. Message qui propose de les organiser ensemble, léger et sympa.`,
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: NOVA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contextPrompts[triggerType] }]
    })
    return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  } catch (e) {
    console.error('Claude generation failed:', e)
    // Fallback si Claude échoue
    const fallbacks: Record<string, string> = {
      absence_2j: `Hé ${prenom} 💜 ça fait 2 jours... tkt, t'es pas obligée de tout gérer tout le temps. On fait le point si tu veux ?`,
      absence_5j: `${prenom} tu m'as manqué 💜 Pas de pression, je suis là quand tu veux reprendre. T'es là ?`,
      absence_10j: `${prenom} 💜 Peu importe ce qui se passe, je suis là. Quand tu veux, on repart ensemble.`,
      taches_en_attente: `Hé ${prenom} ! Tes tâches t'attendent mais pas de stress. On les regarde ensemble ? Même 10 min ça suffit 💜`,
    }
    return fallbacks[triggerType] || `Hé ${prenom} 💜 On fait le point ?`
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const results: string[] = []

  try {
    // Users avec push actif
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
    const uniqueUserIds = Array.from(new Set((subs || []).map(s => s.user_id)))

    // ─── 1. BRIEF MATIN ─────────────────────────────────────────────────
    for (const userId of uniqueUserIds) {
      const { data: todayTasks } = await supabaseAdmin
        .from('tasks')
        .select('title, status, start_hour')
        .eq('user_id', userId)
        .eq('date', today)
        .order('start_hour', { ascending: true })

      const pending = (todayTasks || []).filter(t => t.status !== 'completed')

      const { data: progress } = await supabaseAdmin
        .from('program_progress')
        .select('current_day')
        .eq('user_id', userId)
        .maybeSingle()

      let body = ''
      if (progress?.current_day) body += `Jour ${progress.current_day}/90. `

      if (pending.length > 0) {
        const titles = pending.slice(0, 3).map(t => (t.title || '').trim()).filter(Boolean).join(', ')
        const extra = pending.length > 3 ? ` +${pending.length - 3}` : ''
        body += `Au programme : ${titles}${extra}. `
      } else {
        body += "Aucune tâche prévue, journée libre. "
      }
      body += "Bon rituel du matin ✦"

      await notifyUser({
        userId,
        type: 'morning_brief',
        title: '☀️ Ton récap du jour',
        body,
        url: '/program',
        preferenceKey: 'notif_routines',
      })
      results.push(`Brief matin → ${userId} (${pending.length} tâches)`)
    }

    // ─── 2. ANNIVERSAIRES ───────────────────────────────────────────────
    const { data: families } = await supabaseAdmin
      .from('family_data')
      .select('user_id, data')
      .eq('is_active', true)

    const todayMonth = now.getUTCMonth() + 1
    const todayDay = now.getUTCDate()
    const in7 = new Date(now); in7.setUTCDate(in7.getUTCDate() + 7)
    const t7Month = in7.getUTCMonth() + 1
    const t7Day = in7.getUTCDate()

    for (const member of families || []) {
      const data = member.data as Record<string, unknown>
      const dateStr = data?.birthDate || data?.birthday
      if (!dateStr) continue
      const parts = String(dateStr).split('-').map(Number)
      if (parts.length < 3) continue
      const [, bMonth, bDay] = parts
      const memberName = (data.firstName || data.name || 'Un proche') as string

      if (bMonth === t7Month && bDay === t7Day) {
        await notifyUser({
          userId: member.user_id,
          type: 'birthday_reminder_7',
          title: '🎁 Anniversaire dans 7 jours',
          body: `${memberName} fête son anniversaire le ${t7Day}/${t7Month}. Pense au cadeau ! ✦`,
          url: '/family',
          preferenceKey: 'notif_anniversaires',
        })
        results.push(`Anniv J-7 ${memberName} → ${member.user_id}`)
      }
      if (bMonth === todayMonth && bDay === todayDay) {
        await notifyUser({
          userId: member.user_id,
          type: 'birthday_reminder_0',
          title: `🎂 C'est l'anniversaire de ${memberName}`,
          body: `Pense à lui souhaiter aujourd'hui ! ✦`,
          url: '/family',
          preferenceKey: 'notif_anniversaires',
        })
        results.push(`Anniv J ${memberName} → ${member.user_id}`)
      }
    }

    // ─── 3. NOVA PROACTIVE — messages intelligents ───────────────────────
    const date2 = new Date(now); date2.setUTCDate(date2.getUTCDate() - 2)
    const date5 = new Date(now); date5.setUTCDate(date5.getUTCDate() - 5)
    const date10 = new Date(now); date10.setUTCDate(date10.getUTCDate() - 10)
    const str2 = date2.toISOString().split('T')[0]
    const str5 = date5.toISOString().split('T')[0]
    const str10 = date10.toISOString().split('T')[0]

    const { data: inactives } = await supabaseAdmin
      .from('user_progress')
      .select('user_id, last_active_date, current_streak')
      .lt('last_active_date', str2)

    for (const u of inactives || []) {
      // Vérifier qu'on n'a pas déjà envoyé un message Nova aujourd'hui
      const { data: existing } = await supabaseAdmin
        .from('nova_pending_messages')
        .select('id')
        .eq('user_id', u.user_id)
        .gte('created_at', `${today}T00:00:00`)
        .limit(1)

      if (existing?.length) continue

      // Récupérer le prénom
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', u.user_id)
        .maybeSingle()

      const prenom = userData?.full_name?.split(' ')[0] || 'toi'
      const last = u.last_active_date

      let triggerType = 'absence_2j'
      if (last <= str10) triggerType = 'absence_10j'
      else if (last <= str5) triggerType = 'absence_5j'

      // Générer le message avec Claude
      const message = await generateNovaMessage(prenom, triggerType, {})
      const threadId = `nova-${u.user_id}-${Date.now()}`

      // Stocker dans nova_pending_messages
      await supabaseAdmin.from('nova_pending_messages').insert({
        user_id: u.user_id,
        message,
        trigger_type: triggerType,
        thread_id: threadId,
        is_read: false
      })

      // Envoyer la notif push
      await notifyUser({
        userId: u.user_id,
        type: triggerType,
        title: 'Nova 💜',
        body: message.substring(0, 100),
        url: `/agent?nova_thread=${threadId}`,
        preferenceKey: 'notif_inactivite',
      })

      results.push(`Nova proactive ${triggerType} → ${u.user_id}`)
    }

    // ─── 4. TÂCHES EN ATTENTE (3+) ──────────────────────────────────────
    const { data: todoUsers } = await supabaseAdmin
      .from('todo_list')
      .select('user_id')
      .eq('completed', false)

    const tachesCounts: Record<string, number> = {}
    for (const t of todoUsers || []) {
      tachesCounts[t.user_id] = (tachesCounts[t.user_id] || 0) + 1
    }

    for (const [userId, count] of Object.entries(tachesCounts)) {
      if (count < 3) continue

      // Pas déjà notifiée aujourd'hui
      const { data: existing } = await supabaseAdmin
        .from('nova_pending_messages')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .limit(1)

      if (existing?.length) continue

      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()

      const prenom = userData?.full_name?.split(' ')[0] || 'toi'
      const message = await generateNovaMessage(prenom, 'taches_en_attente', { nb_taches: count })
      const threadId = `nova-${userId}-${Date.now()}`

      await supabaseAdmin.from('nova_pending_messages').insert({
        user_id: userId,
        message,
        trigger_type: 'taches_en_attente',
        thread_id: threadId,
        is_read: false
      })

      await notifyUser({
        userId,
        type: 'taches_en_attente',
        title: 'Nova 💜',
        body: message.substring(0, 100),
        url: `/agent?nova_thread=${threadId}`,
        preferenceKey: 'notif_inactivite',
      })

      results.push(`Nova tâches (${count}) → ${userId}`)
    }

    return NextResponse.json({ success: true, executed: results, count: results.length })
  } catch (error) {
    console.error('[cron/morning] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}