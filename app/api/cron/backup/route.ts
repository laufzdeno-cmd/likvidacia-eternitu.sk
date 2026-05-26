import { NextResponse } from 'next/server';
import { del, list, put } from '@vercel/blob';
import { exportDatabaseBackup } from '@/src/server/db';

export const runtime = 'nodejs';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is required for backups.' }, { status: 500 });
  }

  const backup = await exportDatabaseBackup();
  const pathname = `backup/${todayKey()}/db-backup.json`;
  await put(pathname, JSON.stringify(backup, null, 2), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
  });

  const files = await list({ prefix: 'backup/' });
  const backupFiles = files.blobs
    .filter((blob) => blob.pathname.endsWith('/db-backup.json'))
    .sort((a, b) => b.pathname.localeCompare(a.pathname));
  const old = backupFiles.slice(12);
  if (old.length) await del(old.map((blob) => blob.pathname));

  return NextResponse.json({ ok: true, path: pathname, kept: Math.min(backupFiles.length, 12), deleted: old.length });
}
