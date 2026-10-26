import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { addAuditLog, ensureServerDatabaseSchema, getServerDatabasePool } from './db';
import { gmailErrorCode, gmailPriceOfferMaxAttempts, gmailRetryDelayMinutes } from './gmail-price-offer-policy';
import type {
  GmailPriceOfferConnection,
  GmailPriceOfferJobClaim,
  GmailPriceOfferJobStatus,
  GmailPriceOfferJobSummary,
  GmailPriceOfferJobView,
} from './gmail-price-offer-types';

function requireDatabase() {
  const db = getServerDatabasePool();
  if (!db) throw new Error('Gmail integrácia vyžaduje produkčnú PostgreSQL databázu.');
  return db;
}

function iso(value: unknown) {
  return value ? new Date(String(value)).toISOString() : undefined;
}

function toConnection(row: Record<string, unknown>): GmailPriceOfferConnection {
  return {
    emailAddress: String(row.email_address || ''),
    active: Boolean(row.active),
    labelId: String(row.label_id || ''),
    labelName: String(row.label_name || ''),
    connectedBy: String(row.connected_by || ''),
    connectedAt: new Date(String(row.connected_at)).toISOString(),
    tokenValidatedAt: iso(row.token_validated_at),
    lastSuccessAt: iso(row.last_success_at),
    lastErrorCode: String(row.last_error_code || ''),
  };
}

export async function createGmailOAuthState(actorEmail: string, encryptedCodeVerifier: string) {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  const state = randomBytes(32).toString('base64url');
  const stateHash = createHash('sha256').update(state).digest('hex');
  await db.query('DELETE FROM gmail_price_offer_oauth_states WHERE expires_at < now() OR used_at IS NOT NULL');
  await db.query(
    `INSERT INTO gmail_price_offer_oauth_states (state_hash,actor_email,encrypted_code_verifier,expires_at)
     VALUES ($1,lower($2),$3,now() + interval '10 minutes')`,
    [stateHash, actorEmail, encryptedCodeVerifier],
  );
  return state;
}

export async function consumeGmailOAuthState(state: string, actorEmail: string) {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  const stateHash = createHash('sha256').update(state).digest('hex');
  const result = await db.query(
    `UPDATE gmail_price_offer_oauth_states SET used_at=now()
     WHERE state_hash=$1 AND lower(actor_email)=lower($2) AND used_at IS NULL AND expires_at > now()
     RETURNING encrypted_code_verifier`,
    [stateHash, actorEmail],
  );
  return result.rows[0] ? String(result.rows[0].encrypted_code_verifier) : '';
}

export async function activateGmailPriceOfferConnection(input: {
  emailAddress: string;
  encryptedRefreshToken: string;
  labelId: string;
  labelName: string;
  actorEmail: string;
}) {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  await db.query(
    `INSERT INTO gmail_price_offer_connections (
       connection_key,email_address,encrypted_refresh_token,active,label_id,label_name,connected_by,
       connected_at,token_validated_at,last_success_at,last_error_code,updated_at
     ) VALUES ('primary',lower($1),$2,true,$3,$4,$5,now(),now(),now(),'',now())
     ON CONFLICT (connection_key) DO UPDATE SET
       email_address=EXCLUDED.email_address,
       encrypted_refresh_token=EXCLUDED.encrypted_refresh_token,
       active=true,label_id=EXCLUDED.label_id,label_name=EXCLUDED.label_name,
       connected_by=EXCLUDED.connected_by,connected_at=now(),token_validated_at=now(),
       last_success_at=now(),last_error_code='',updated_at=now()`,
    [input.emailAddress, input.encryptedRefreshToken, input.labelId, input.labelName, input.actorEmail],
  );
}

export async function getGmailPriceOfferConnection() {
  await ensureServerDatabaseSchema();
  const db = getServerDatabasePool();
  if (!db) return undefined;
  const result = await db.query(
    `SELECT connection_key,email_address,active,label_id,label_name,connected_by,connected_at,
            token_validated_at,last_success_at,last_error_code
     FROM gmail_price_offer_connections WHERE connection_key='primary' AND active=true`,
  );
  return result.rows[0] ? toConnection(result.rows[0]) : undefined;
}

export async function getGmailPriceOfferConnectionSecret() {
  await ensureServerDatabaseSchema();
  const db = getServerDatabasePool();
  if (!db) return undefined;
  const result = await db.query(
    `SELECT connection_key,email_address,encrypted_refresh_token,active,label_id,label_name,connected_by,
            connected_at,token_validated_at,last_success_at,last_error_code
     FROM gmail_price_offer_connections WHERE connection_key='primary' AND active=true`,
  );
  if (!result.rows[0]) return undefined;
  return {
    connection: toConnection(result.rows[0]),
    encryptedRefreshToken: String(result.rows[0].encrypted_refresh_token),
  };
}

export async function updateGmailConnectionLabel(labelId: string, labelName: string) {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  await db.query(
    `UPDATE gmail_price_offer_connections SET label_id=$1,label_name=$2,last_error_code='',updated_at=now()
     WHERE connection_key='primary' AND active=true`,
    [labelId, labelName],
  );
}

export async function recordGmailConnectionResult(success: boolean, errorCode = '') {
  await ensureServerDatabaseSchema();
  const db = getServerDatabasePool();
  if (!db) return;
  await db.query(
    `UPDATE gmail_price_offer_connections SET
       token_validated_at=CASE WHEN $1 THEN now() ELSE token_validated_at END,
       last_success_at=CASE WHEN $1 THEN now() ELSE last_success_at END,
       last_error_code=CASE WHEN $1 THEN '' ELSE $2 END,
       updated_at=now()
     WHERE connection_key='primary' AND active=true`,
    [success, gmailErrorCode(errorCode)],
  );
}

export async function disconnectGmailPriceOfferConnection(actorEmail: string) {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  const result = await db.query(
    `UPDATE gmail_price_offer_connections
     SET active=false,encrypted_refresh_token='',last_error_code='',updated_at=now()
     WHERE connection_key='primary' AND active=true RETURNING email_address`,
  );
  if (result.rows[0]) {
    await addAuditLog('system', randomUUID(), 'gmail_price_offer_disconnected', actorEmail, {
      account: String(result.rows[0].email_address).replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    });
  }
  return Boolean(result.rowCount);
}

export async function getGmailPriceOfferJobSummary(): Promise<GmailPriceOfferJobSummary> {
  await ensureServerDatabaseSchema();
  const db = getServerDatabasePool();
  const empty = { pending: 0, processing: 0, retry: 0, completed: 0, attention: 0 };
  if (!db) return empty;
  const result = await db.query(
    `SELECT status,count(*)::int AS count FROM gmail_price_offer_label_jobs GROUP BY status`,
  );
  for (const row of result.rows) {
    const status = String(row.status) as GmailPriceOfferJobStatus;
    if (status in empty) empty[status] = Number(row.count || 0);
  }
  return empty;
}

export async function getGmailPriceOfferJobForOffer(offerId: string): Promise<GmailPriceOfferJobView | undefined> {
  await ensureServerDatabaseSchema();
  const db = getServerDatabasePool();
  if (!db) return undefined;
  const result = await db.query(
    `SELECT status,attempts,last_error_code,completed_at,updated_at
     FROM gmail_price_offer_label_jobs WHERE offer_id=$1`,
    [offerId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    status: String(row.status) as GmailPriceOfferJobStatus,
    attempts: Number(row.attempts || 0),
    lastErrorCode: String(row.last_error_code || ''),
    completedAt: iso(row.completed_at),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function claimDueGmailPriceOfferJobs(limit = 10): Promise<GmailPriceOfferJobClaim[]> {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  const safeLimit = Math.max(1, Math.min(25, Math.floor(limit)));
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE gmail_price_offer_label_jobs SET
         status=CASE WHEN attempts >= $1 THEN 'attention' ELSE 'retry' END,
         next_attempt_at=CASE WHEN attempts >= $1 THEN next_attempt_at ELSE now() END,
         claim_token=NULL,claimed_at=NULL,last_error_code='stale_claim_recovered',updated_at=now()
       WHERE status='processing' AND claimed_at < now() - interval '15 minutes'`,
      [gmailPriceOfferMaxAttempts],
    );
    const claimToken = randomUUID();
    const result = await client.query(
      `WITH candidates AS (
         SELECT id FROM gmail_price_offer_label_jobs
         WHERE status IN ('pending','retry') AND next_attempt_at <= now() AND attempts < $1
         ORDER BY next_attempt_at,created_at
         FOR UPDATE SKIP LOCKED LIMIT $2
       )
       UPDATE gmail_price_offer_label_jobs j SET
         status='processing',attempts=j.attempts + 1,claim_token=$3,claimed_at=now(),updated_at=now()
       FROM candidates c WHERE j.id=c.id
       RETURNING j.id,j.offer_id,j.rfc822_message_id,j.claim_token,j.attempts`,
      [gmailPriceOfferMaxAttempts, safeLimit, claimToken],
    );
    await client.query('COMMIT');
    return result.rows.map((row) => ({
      id: String(row.id), offerId: String(row.offer_id), rfc822MessageId: String(row.rfc822_message_id),
      claimToken: String(row.claim_token), attempts: Number(row.attempts),
    }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeGmailPriceOfferJob(input: {
  id: string;
  claimToken: string;
  outcome: 'completed' | 'retry' | 'attention';
  gmailMessageId?: string;
  errorCode?: string;
  attempts: number;
}) {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  const finalOutcome = input.outcome === 'retry' && input.attempts >= gmailPriceOfferMaxAttempts ? 'attention' : input.outcome;
  const delay = gmailRetryDelayMinutes(input.attempts);
  const result = await db.query(
    `UPDATE gmail_price_offer_label_jobs SET
       status=$3,gmail_message_id=CASE WHEN $3='completed' THEN $4 ELSE gmail_message_id END,
       last_error_code=CASE WHEN $3='completed' THEN '' ELSE $5 END,
       next_attempt_at=CASE WHEN $3='retry' THEN now() + ($6::text || ' minutes')::interval ELSE next_attempt_at END,
       claim_token=NULL,claimed_at=NULL,
       completed_at=CASE WHEN $3='completed' THEN now() ELSE completed_at END,
       updated_at=now()
     WHERE id=$1 AND claim_token=$2 AND status='processing' RETURNING offer_id`,
    [input.id, input.claimToken, finalOutcome, input.gmailMessageId || '', gmailErrorCode(input.errorCode), delay],
  );
  return result.rows[0] ? String(result.rows[0].offer_id) : '';
}

export async function requeueGmailPriceOfferAttentionJobs(actorEmail: string) {
  await ensureServerDatabaseSchema();
  const db = requireDatabase();
  const result = await db.query(
    `UPDATE gmail_price_offer_label_jobs SET status='pending',attempts=0,next_attempt_at=now(),
       claim_token=NULL,claimed_at=NULL,last_error_code='',updated_at=now()
     WHERE status='attention' RETURNING id`,
  );
  await addAuditLog('system', randomUUID(), 'gmail_price_offer_jobs_requeued', actorEmail, { count: result.rowCount || 0 });
  return result.rowCount || 0;
}
