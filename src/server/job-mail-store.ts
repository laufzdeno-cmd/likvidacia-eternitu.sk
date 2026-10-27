import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getServerDatabasePool } from './db';
import { deploymentDatabaseAccessBlocked } from './preview-safety';
import type { JobWorkspaceActor } from './job-workspace-types';
import type { JobMailConfiguration, JobMailMessage, JobMailMatch, JobMailStore } from './job-mail-types';

export function emptyJobMailStore(): JobMailStore {
  return { configuration: { enabled: false, labelIds: [], since: '', maxMessages: 10, verificationAcknowledged: false, revision: 0, updatedAt: null, updatedBy: null }, messages: [], pageTokens: {} };
}
function assertSuperadmin(actor: JobWorkspaceActor) {
  if (actor.role !== 'SUPER_ADMIN' || !actor.email) throw new Error('Gmail môže spravovať iba superadmin.');
}
function filePath() {
  return `${process.env.ASTANA_LOCAL_DB_PATH || path.join(process.cwd(), '.data', 'local-db.json')}.job-mail.json`;
}
function assertLocal() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') throw new Error('Gmail evidencia vyžaduje overenú databázu.');
}
async function readLocal(): Promise<JobMailStore> {
  try { return JSON.parse(await readFile(filePath(), 'utf8')) as JobMailStore; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyJobMailStore(); throw error; }
}
export async function readJobMailStore(actor: JobWorkspaceActor): Promise<JobMailStore> {
  assertSuperadmin(actor);
  const db = getServerDatabasePool();
  if (db) {
    const result = await db.query('SELECT payload FROM job_mail_workspace_state WHERE id=1');
    return result.rows[0]?.payload as JobMailStore || emptyJobMailStore();
  }
  assertLocal();
  return readLocal();
}

export async function mutateJobMailStore<T>(actor: JobWorkspaceActor, change: (state: JobMailStore) => Promise<T> | T): Promise<T> {
  assertSuperadmin(actor);
  if (deploymentDatabaseAccessBlocked()) throw new Error('Gmail zápis v náhľade nie je povolený.');
  const db = getServerDatabasePool();
  if (db) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT payload FROM job_mail_workspace_state WHERE id=1 FOR UPDATE');
      if (!result.rows[0]) throw new Error('Databáza Gmail evidencie vyžaduje migráciu.');
      const state = result.rows[0].payload as JobMailStore;
      const value = await change(state);
      await client.query('UPDATE job_mail_workspace_state SET payload=$1::jsonb, updated_at=now() WHERE id=1', [JSON.stringify(state)]);
      await client.query('COMMIT');
      return value;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  assertLocal();
  const target = filePath();
  await mkdir(path.dirname(target), { recursive: true });
  const lock = `${target}.lock`;
  const deadline = Date.now() + 8_000;
  while (true) {
    try { await mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || Date.now() > deadline) throw new Error('Gmail evidencia je práve upravovaná. Skúste to znova.');
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    const state = await readLocal();
    const result = await change(state);
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    // Windows scanners can briefly hold a newly written file; preserve the atomic replacement and retry it.
    for (let attempt = 0; ; attempt++) {
      try { await rename(temporary, target); break; }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt >= 5 || !['EPERM', 'EACCES'].includes(code || '')) throw error;
        await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
      }
    }
    return result;
  } finally { await rm(temporary, { force: true }); await rm(lock, { recursive: true, force: true }); }
}

export async function saveJobMailConfiguration(input: Omit<JobMailConfiguration, 'revision' | 'updatedAt' | 'updatedBy'> & { expectedRevision: number }, actor: JobWorkspaceActor) {
  if (!Number.isSafeInteger(input.expectedRevision) || typeof input.enabled !== 'boolean' || typeof input.verificationAcknowledged !== 'boolean') throw new Error('Neplatné nastavenie Gmailu.');
  const labels = [...new Set(input.labelIds)];
  const date = new Date(`${input.since}T00:00:00Z`);
  if (labels.length > 5 || !labels.every((id) => /^[a-zA-Z0-9_-]{1,200}$/.test(id))) throw new Error('Vyberte najviac päť firemných štítkov.');
  if (input.enabled && (!labels.length || !/^20\d{2}-\d{2}-\d{2}$/.test(input.since) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== input.since || date.valueOf() > Date.now() || !input.verificationAcknowledged)) throw new Error('Pred zapnutím vyberte firemné štítky, dátum a potvrďte overenie prístupu.');
  if (input.enabled && process.env.ASTANA_JOB_GMAIL_VERIFIED !== 'true') throw new Error('Čítanie Gmailu čaká na potvrdenie overenia Google.');
  return mutateJobMailStore(actor, (state) => {
    if (state.configuration.revision !== input.expectedRevision) throw new Error('Nastavenie sa medzičasom zmenilo. Obnovte stránku.');
    if (state.configuration.since !== input.since || state.configuration.labelIds.join(',') !== labels.join(',')) state.pageTokens = {};
    state.configuration = { enabled: input.enabled, labelIds: labels, since: input.since, maxMessages: Math.max(1, Math.min(25, Math.floor(input.maxMessages) || 10)), verificationAcknowledged: input.verificationAcknowledged, revision: input.expectedRevision + 1, updatedAt: new Date().toISOString(), updatedBy: actor.email };
    return state.configuration;
  });
}
export async function disableJobMailSync(actor: JobWorkspaceActor) {
  return mutateJobMailStore(actor, (state) => {
    state.configuration.enabled = false;
    state.configuration.revision++;
    state.configuration.updatedAt = new Date().toISOString();
    state.configuration.updatedBy = actor.email;
    return state.configuration;
  });
}
export async function stageJobMailMessages(input: { account: string; messages: Array<{ message: JobMailMessage; matches: JobMailMatch[] }>; pageTokens: Record<string, string>; expectedRevision: number }, actor: JobWorkspaceActor) {
  return mutateJobMailStore(actor, (state) => {
    // Turning sync off or changing label scope during a network request invalidates that in-flight run.
    if (!state.configuration.enabled || state.configuration.revision !== input.expectedRevision) throw new Error('Synchronizácia bola zastavená alebo sa zmenil jej rozsah.');
    let added = 0;
    for (const { message, matches } of input.messages) {
      const id = createHash('sha256').update(`${input.account.toLowerCase()}:${message.messageId}`).digest('hex');
      if (state.messages.some((item) => item.id === id)) continue;
      state.messages.push({ ...message, id, account: input.account.toLowerCase(), importedAt: new Date().toISOString(), matches, review: 'PENDING', linkedJobId: null, reviewedAt: null, reviewedBy: null });
      added++;
    }
    state.pageTokens = input.pageTokens;
    return added;
  });
}
