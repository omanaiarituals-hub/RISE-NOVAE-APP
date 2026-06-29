// src/app/api/cron/morning/route.ts
// CORRECTION P0 : ajout du reset des routines completed=false chaque matin
// AVANT le brief, on remet completed=false pour toutes les utilisatrices actives.
// Le reste du fichier est identique.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'

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
  const reve = typeof context.reve === 'string' && context.reve.trim() ? context.reve.trim() : ''
  const reveHint = reve
    ? ` Son rêve, qu'elle t'a confié : "${reve}". Tu PEUX t'y référer avec délicatesse pour la remotiver, comme un phare — jamais comme un reproche.`
    : ''

  const contextPrompts: Record<string, string> = {
    absence_2j: `L'utilisatrice s'appelle ${prenom} et n'a pas avancé sur son programme 90 jours depuis 2 jours (elle utilise peut-être le reste de l'app, ne dis donc PAS qu'elle a disparu). Message doux qui propose de reprendre le programme ensemble.${reveHint}`,
    absence_5j: `L'utilisatrice s'appelle ${prenom} et n'a pas avancé sur son programme 90 jours depuis 5 jours (elle utilise peut-être le reste de l'app, ne dis donc PAS qu'elle a disparu ni qu'elle te manque). Message chaleureux, sans pression, qui invite à reprendre le programme.${reveHint}`,
    absence_10j: `L'utilisatrice s'appelle ${prenom} et n'a pas avancé sur son programme 90 jours depuis 10 jours (elle utilise peut-être le reste de l'app, ne dis donc PAS qu'elle a disparu). Message bienveillant qui rappelle que le programme l'attend et qu'on peut reprendre à son rythme.${reveHint}`,
    taches_en_attente: `L'utilisatrice s'appelle ${prenom} et a ${context.nb_taches} tâches non planifiées. Message qui propose de les organiser ensemble, léger et sympa.`,
    notes_a_trier: `L'utilisatrice s'appelle ${prenom} et a ${context.nb_notes} notes non triées dans son carnet de notes. Message qui propose de les relire ensemble, transformer celles qui doivent devenir une tâche ou un défi, et ranger le reste. Léger, sans pression, pas de liste à puces.${reveHint}`,
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system: NOVA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contextPrompts[triggerType] }]
    })
    return response.content[0].type === 'text'
      ? response.content[0].text.trim().replace(/\s*—\s*/g, ' ')
      : ''
  } catch (e) {
    console.error('Claude generation failed:', e)
    const fallbacks: Record<string, string> = {
      absence_2j: `Hé ${prenom} 💜 ça fait 2 jours qu'on n'a pas avancé sur ton programme. On reprend quand tu veux, même 5 min ?`,
      absence_5j: `${prenom} 💜 ton programme t'attend depuis 5 jours. Pas de pression, on repart où tu veux. Tu me dis ?`,
      absence_10j: `${prenom} 💜 ça fait 10 jours qu'on n'a pas touché à ton programme. Peu importe le rythme, je suis là pour reprendre ensemble quand tu le sens.`,
      taches_en_attente: `Hé ${prenom} ! Tes tâches t'attendent mais pas de stress. On les regarde ensemble ? Même 10 min ça suffit 💜`,
      notes_a_trier: `${prenom} 💜 tu as ${context.nb_notes} notes qui traînent dans ton carnet. On les trie ensemble quand tu veux, ça prend 5 min et ça libère la tête.`,
    }
    return fallbacks[triggerType] || `Hé ${prenom} 💜 On fait le point ?`
  }
}

// Calcule la date du jour en heure de Paris (pas UTC)
function getTodayParis(): string {
  const now = new Date()
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${paris.getFullYear()}-${pad(paris.getMonth() + 1)}-${pad(paris.getDate())}`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = getTodayParis()
  const now = new Date()
  const results: string[] = []

  try {
    // ─── 0. RESET DES ROUTINES ──────────────────────────────────────────
    // Chaque matin, toutes les routines repassent à completed=false
    // pour que les utilisatrices puissent les cocher à nouveau aujourd'hui.
    // On ne remet à zéro que celles qui ont été complétées AVANT aujourd'hui.
    const { error: resetError } = await supabaseAdmin
      .from('routines')
      .update({ completed: false })
      .eq('completed', true)
      .lt('last_completed_at', `${today}T00:00:00+00:00`)

    if (resetError) {
      console.error('[cron/morning] Erreur reset routines:', resetError)
    } else {
      results.push('Reset routines completed=false ✓')
    }

    // ─── 1. BRIEF MATIN ─────────────────────────────────────────────────
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
    const uniqueUserIds = Array.from(new Set((subs || []).map(s => s.user_id)))

    for (const userId of uniqueUserIds) {
      const { data: todayTasks } = await supabaseAdmin
        .from('planner_events')
        .select('title, status, start_minutes')
        .eq('user_id', userId)
        .gte('start_date', `${today}T00:00:00+00:00`)
        .lte('start_date', `${today}T23:59:59+00:00`)
        .order('start_minutes', { ascending: true })

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
        body += 'Aucune tâche prévue, journée libre. '
      }
      body += 'Bon rituel du matin ✦'

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

    // ─── 3. NOVA PROACTIVE ───────────────────────────────────────────────
    const date2 = new Date(now); date2.setUTCDate(date2.getUTCDate() - 2)
    const date5 = new Date(now); date5.setUTCDate(date5.getUTCDate() - 5)
    const date10 = new Date(now); date10.setUTCDate(date10.getUTCDate() - 10)
    const str2 = date2.toISOString().split('T')[0]
    const str5 = date5.toISOString().split('T')[0]
    const str10 = date10.toISOString().split('T')[0]

    const { data: inactives } = await supabaseAdmin
      .from('program_progress')
      .select('user_id, last_access_date, current_day')
      .lt('last_access_date', str2)

    for (const u of inactives || []) {
      const { data: existing } = await supabaseAdmin
        .from('nova_pending_messages')
        .select('id')
        .eq('user_id', u.user_id)
        .gte('created_at', `${today}T00:00:00`)
        .limit(1)
      if (existing?.length) continue

      const { data: profile } = await supabaseAdmin
        .from('ai_personality_profile')
        .select('pseudo, reve')
        .eq('user_id', u.user_id)
        .maybeSingle()
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', u.user_id)
        .maybeSingle()

      const prenom = profile?.pseudo || userData?.full_name?.split(' ')[0] || 'toi'
      const reve = profile?.reve || ''
      const last = u.last_access_date ? u.last_access_date.split('T')[0] : '2000-01-01'

      let triggerType = 'absence_2j'
      if (last <= str10) triggerType = 'absence_10j'
      else if (last <= str5) triggerType = 'absence_5j'

      const message = await generateNovaMessage(prenom, triggerType, { reve })
      const threadId = randomUUID()

      await supabaseAdmin.from('nova_pending_messages').insert({
        user_id: u.user_id, message, trigger_type: triggerType,
        thread_id: threadId, is_read: false
      })
      await notifyUser({
        userId: u.user_id, type: triggerType, title: 'Nova 💜',
        body: message.substring(0, 100), url: `/agent?nova_thread=${threadId}`,
        preferenceKey: 'notif_inactivite',
      })
      results.push(`Nova proactive ${triggerType} → ${u.user_id}`)
    }

    // ─── 4. TÂCHES EN ATTENTE (3+) ──────────────────────────────────────
    const { data: todoUsers } = await supabaseAdmin
      .from('todo_list').select('user_id').eq('status', 'pending')

    const tachesCounts: Record<string, number> = {}
    for (const t of todoUsers || []) {
      tachesCounts[t.user_id] = (tachesCounts[t.user_id] || 0) + 1
    }

    for (const [userId, count] of Object.entries(tachesCounts)) {
      if (count < 3) continue
      const { data: existing } = await supabaseAdmin
        .from('nova_pending_messages').select('id').eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`).limit(1)
      if (existing?.length) continue

      const { data: profileT } = await supabaseAdmin
        .from('ai_personality_profile').select('pseudo').eq('user_id', userId).maybeSingle()
      const { data: userData } = await supabaseAdmin
        .from('users').select('full_name').eq('id', userId).maybeSingle()
      const prenom = profileT?.pseudo || userData?.full_name?.split(' ')[0] || 'toi'
      const message = await generateNovaMessage(prenom, 'taches_en_attente', { nb_taches: count })
      const threadId = randomUUID()

      await supabaseAdmin.from('nova_pending_messages').insert({
        user_id: userId, message, trigger_type: 'taches_en_attente',
        thread_id: threadId, is_read: false
      })
      await notifyUser({
        userId, type: 'taches_en_attente', title: 'Nova 💜',
        body: message.substring(0, 100), url: `/agent?nova_thread=${threadId}`,
        preferenceKey: 'notif_inactivite',
      })
      results.push(`Nova tâches (${count}) → ${userId}`)
    }

    // ─── 5. NOTES NON TRIÉES (5+) ───────────────────────────────────────
    const { data: noteUsers } = await supabaseAdmin.from('notes').select('user_id')
    const notesCounts: Record<string, number> = {}
    for (const n of noteUsers || []) {
      notesCounts[n.user_id] = (notesCounts[n.user_id] || 0) + 1
    }

    for (const [userId, count] of Object.entries(notesCounts)) {
      if (count < 5) continue
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: existingNotes } = await supabaseAdmin
        .from('nova_pending_messages').select('id').eq('user_id', userId)
        .eq('trigger_type', 'notes_a_trier').gte('created_at', sevenDaysAgo).limit(1)
      if (existingNotes?.length) continue

      const { data: profileN } = await supabaseAdmin
        .from('ai_personality_profile').select('pseudo').eq('user_id', userId).maybeSingle()
      const { data: userDataN } = await supabaseAdmin
        .from('users').select('full_name').eq('id', userId).maybeSingle()
      const prenomN = profileN?.pseudo || userDataN?.full_name?.split(' ')[0] || 'toi'
      const messageN = await generateNovaMessage(prenomN, 'notes_a_trier', { nb_notes: count })
      const threadIdN = randomUUID()

      await supabaseAdmin.from('nova_pending_messages').insert({
        user_id: userId, message: messageN, trigger_type: 'notes_a_trier',
        thread_id: threadIdN, is_read: false
      })
      await notifyUser({
        userId, type: 'notes_a_trier', title: 'Nova 💜',
        body: messageN.substring(0, 100), url: `/agent?nova_thread=${threadIdN}`,
        preferenceKey: 'notif_inactivite',
      })
      results.push(`Nova notes (${count}) → ${userId}`)
    }

    return NextResponse.json({ success: true, executed: results, count: results.length })
  } catch (error) {
    console.error('[cron/morning] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}