import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getStreak, recordCheckIn } from '@/lib/streak';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const state = await getStreak(SUPABASE_URL, SERVICE_ROLE_KEY, userId);
    return NextResponse.json(
      state ?? {
        current: 0,
        longest: 0,
        freezesRemaining: 1,
        lastActivityDate: null,
        flameLitAt: null,
        level: 0,
      }
    );
  } catch (e) {
    console.error('[streak GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await recordCheckIn(SUPABASE_URL, SERVICE_ROLE_KEY, userId);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[streak POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}