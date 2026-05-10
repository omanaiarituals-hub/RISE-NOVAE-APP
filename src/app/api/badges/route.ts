import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { BADGES_BY_ID } from '@/lib/badges';
import { logEvent } from '@/lib/events';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** GET — liste les badges débloqués de l'utilisatrice */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at, shared_at')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  return NextResponse.json({ earned: data ?? [] });
}

/** POST — partage un badge dans la communauté */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const badgeId = body.badgeId as string | undefined;
  const customMessage = (body.message as string | undefined)?.trim();

  if (!badgeId || !BADGES_BY_ID[badgeId]) {
    return NextResponse.json({ error: 'Invalid badge' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Vérifier que l'utilisatrice possède bien ce badge
  const { data: badge } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .eq('badge_id', badgeId)
    .maybeSingle();

  if (!badge) {
    return NextResponse.json({ error: 'Badge not earned' }, { status: 403 });
  }

  if (badge.shared_at) {
    return NextResponse.json({ error: 'Already shared' }, { status: 409 });
  }

  const def = BADGES_BY_ID[badgeId];
  const postContent = customMessage || `J'ai débloqué le badge « ${def.name} ». ${def.meaning}`;

  // ⚠️ Adapte le nom de la table à ton schéma communauté.
  // Ici on suppose une table `community_posts` avec (user_id, content, type, badge_id).
  // Si tes colonnes sont différentes, modifie ci-dessous.
  const { data: post, error: postError } = await supabase
    .from('community_posts')
    .insert({
      user_id: userId,
      content: postContent,
      type: 'badge_share',
      badge_id: badgeId,
    })
    .select()
    .single();

  if (postError) {
    console.error('[badges POST] post error', postError);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }

  // Marquer le badge comme partagé
  await supabase
    .from('user_badges')
    .update({ shared_at: new Date().toISOString(), community_post_id: post.id })
    .eq('user_id', userId)
    .eq('badge_id', badgeId);

  await logEvent(supabase, userId, 'badge_shared', { badge_id: badgeId, post_id: post.id });

  return NextResponse.json({ success: true, postId: post.id });
}