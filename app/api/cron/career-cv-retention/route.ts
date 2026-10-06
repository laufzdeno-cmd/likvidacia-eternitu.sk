import { NextResponse } from 'next/server';
import { careerCvRetentionBound, runCareerCvRetention } from '@/src/server/career-cv-retention';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!careerCvRetentionBound()) {
    return NextResponse.json({ ok: false, error: 'Private career CV retention is not verified or enabled.' }, { status: 503 });
  }
  try {
    const result = await runCareerCvRetention();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    console.error('Career CV retention claim failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false, error: 'Career CV retention is unavailable.' }, { status: 503 });
  }
}
