import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { addAuditLog, getServerDatabasePool } from './db';
import type {
  FacebookConversation,
  FacebookConversationCounts,
  FacebookConversationDetail,
  FacebookConversationStatus,
  FacebookMessage,
  FacebookMessageStatus,
  FacebookMessengerListFilter,
  FacebookPageConnection,
} from './facebook-messenger-types';

let schemaReady = false;
let schemaInitialization: Promise<void> | undefined;

function iso(value: unknown) {
  return value ? new Date(String(value)).toISOString() : undefined;
}
function toConnection(row: Record<string, unknown>): FacebookPageConnection {
  return {
    pageId: String(row.page_id),
    pageName: String(row.page_name),
    active: Boolean(row.active),
    connectedBy: String(row.connected_by),
    connectedAt: new Date(String(row.connected_at)).toISOString(),
    disconnectedAt: iso(row.disconnected_at),
    tokenValidatedAt: iso(row.token_validated_at),
    lastWebhookAt: iso(row.last_webhook_at),
  };
}

function toConversation(row: Record<string, unknown>): FacebookConversation {
  return {
    id: String(row.id),
    pageId: String(row.page_id),
    participantId: String(row.participant_id),
    participantName: String(row.participant_name || 'Facebook zákazník'),
    status: String(row.status) as FacebookConversationStatus,
    assignedTo: String(row.assigned_to || ''),
    leadId: row.lead_id ? String(row.lead_id) : undefined,
    unreadCount: Number(row.unread_count || 0),
    lastMessagePreview: String(row.last_message_preview || ''),
    lastInboundAt: iso(row.last_inbound_at),
    lastOutboundAt: iso(row.last_outbound_at),
    lastMessageAt: new Date(String(row.last_message_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function toMessage(row: Record<string, unknown>): FacebookMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    providerMessageId: String(row.provider_message_id || ''),
    clientRequestId: row.client_request_id ? String(row.client_request_id) : undefined,
    direction: String(row.direction) as FacebookMessage['direction'],
    text: String(row.message_text || ''),
    attachmentTypes: Array.isArray(row.attachment_types) ? row.attachment_types.map(String) : [],
    status: String(row.status) as FacebookMessageStatus,
    sentBy: String(row.sent_by || ''),
    errorCode: String(row.error_code || ''),
    providerTimestamp: new Date(String(row.provider_timestamp)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function ensureFacebookMessengerSchema() {
  if (schemaReady) return;
  const db = getServerDatabasePool();
  if (!db) return;
  schemaInitialization ??= (async () => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('astana:facebook-messenger-schema:v1'))");
      await client.query(`
        CREATE TABLE IF NOT EXISTS facebook_page_connections (
          page_id text PRIMARY KEY,
          page_name text NOT NULL,
          encrypted_page_access_token text NOT NULL,
          app_id text NOT NULL,
          graph_version text NOT NULL,
          active boolean NOT NULL DEFAULT true,
          connected_by text NOT NULL,
          connected_at timestamptz NOT NULL DEFAULT now(),
          disconnected_at timestamptz,
          token_validated_at timestamptz,
          last_webhook_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS facebook_oauth_states (
          state_hash char(64) PRIMARY KEY,
          actor_email text NOT NULL,
          expires_at timestamptz NOT NULL,
          used_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS facebook_oauth_states_expiry_idx ON facebook_oauth_states (expires_at);
        CREATE TABLE IF NOT EXISTS facebook_conversations (
          id uuid PRIMARY KEY,
          page_id text NOT NULL REFERENCES facebook_page_connections(page_id) ON DELETE RESTRICT,
          participant_id text NOT NULL,
          participant_name text NOT NULL DEFAULT 'Facebook zákazník',
          status text NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','riesi_sa','cakame_na_zakaznika','vybavena')),
          assigned_to text NOT NULL DEFAULT '',
          lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
          unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
          last_message_preview text NOT NULL DEFAULT '',
          last_inbound_at timestamptz,
          last_outbound_at timestamptz,
          last_message_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (page_id, participant_id)
        );
        CREATE INDEX IF NOT EXISTS facebook_conversations_queue_idx
          ON facebook_conversations (status, unread_count DESC, last_message_at DESC);
        CREATE INDEX IF NOT EXISTS facebook_conversations_assigned_idx
          ON facebook_conversations (lower(assigned_to), status, last_message_at DESC);
        CREATE TABLE IF NOT EXISTS facebook_messages (
          id uuid PRIMARY KEY,
          conversation_id uuid NOT NULL REFERENCES facebook_conversations(id) ON DELETE CASCADE,
          provider_message_id text NOT NULL DEFAULT '',
          client_request_id uuid,
          direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
          message_text text NOT NULL DEFAULT '',
          attachment_types jsonb NOT NULL DEFAULT '[]'::jsonb,
          status text NOT NULL CHECK (status IN ('received','sending','sent','delivered','read','failed','unknown')),
          sent_by text NOT NULL DEFAULT '',
          error_code text NOT NULL DEFAULT '',
          provider_timestamp timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS facebook_messages_provider_mid_uq
          ON facebook_messages (provider_message_id) WHERE provider_message_id <> '';
        CREATE UNIQUE INDEX IF NOT EXISTS facebook_messages_client_request_uq
          ON facebook_messages (client_request_id) WHERE client_request_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS facebook_messages_conversation_time_idx
          ON facebook_messages (conversation_id, provider_timestamp, created_at);
      `);
      await client.query('COMMIT');
      schemaReady = true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      schemaInitialization = undefined;
      throw error;
    } finally {
      client.release();
    }
  })();
  await schemaInitialization;
}

function requireDatabase() {
  const db = getServerDatabasePool();
  if (!db) throw new Error('Facebook správy vyžadujú produkčnú PostgreSQL databázu.');
  return db;
}

export async function createFacebookOAuthState(actorEmail: string) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const state = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(state).digest('hex');
  await db.query('DELETE FROM facebook_oauth_states WHERE expires_at < now() OR used_at IS NOT NULL');
  await db.query(
    `INSERT INTO facebook_oauth_states (state_hash, actor_email, expires_at)
     VALUES ($1,lower($2),now() + interval '10 minutes')`,
    [hash, actorEmail],
  );
  return state;
}

export async function consumeFacebookOAuthState(state: string, actorEmail: string) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const hash = createHash('sha256').update(state).digest('hex');
  const result = await db.query(
    `UPDATE facebook_oauth_states SET used_at=now()
     WHERE state_hash=$1 AND lower(actor_email)=lower($2) AND used_at IS NULL AND expires_at > now()
     RETURNING state_hash`,
    [hash, actorEmail],
  );
  return Boolean(result.rowCount);
}

export async function activateFacebookPageConnection(input: {
  pageId: string;
  pageName: string;
  encryptedPageAccessToken: string;
  appId: string;
  graphVersion: string;
  actorEmail: string;
}) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  await db.query(
    `INSERT INTO facebook_page_connections (
       page_id,page_name,encrypted_page_access_token,app_id,graph_version,active,connected_by,
       connected_at,disconnected_at,token_validated_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,true,$6,now(),NULL,now(),now())
     ON CONFLICT (page_id) DO UPDATE SET
       page_name=EXCLUDED.page_name,
       encrypted_page_access_token=EXCLUDED.encrypted_page_access_token,
       app_id=EXCLUDED.app_id,
       graph_version=EXCLUDED.graph_version,
       active=true,
       connected_by=EXCLUDED.connected_by,
       connected_at=now(),
       disconnected_at=NULL,
       token_validated_at=now(),
       updated_at=now()`,
    [input.pageId, input.pageName.slice(0, 200), input.encryptedPageAccessToken, input.appId, input.graphVersion, input.actorEmail],
  );
}

export async function getFacebookPageConnection() {
  await ensureFacebookMessengerSchema();
  const db = getServerDatabasePool();
  if (!db) return undefined;
  const result = await db.query('SELECT * FROM facebook_page_connections WHERE active=true ORDER BY connected_at DESC LIMIT 1');
  return result.rows[0] ? toConnection(result.rows[0]) : undefined;
}

export async function getFacebookPageConnectionSecret(pageId?: string) {
  await ensureFacebookMessengerSchema();
  const db = getServerDatabasePool();
  if (!db) return undefined;
  const result = pageId
    ? await db.query('SELECT * FROM facebook_page_connections WHERE page_id=$1 AND active=true LIMIT 1', [pageId])
    : await db.query('SELECT * FROM facebook_page_connections WHERE active=true ORDER BY connected_at DESC LIMIT 1');
  const row = result.rows[0];
  if (!row) return undefined;
  return { connection: toConnection(row), encryptedPageAccessToken: String(row.encrypted_page_access_token) };
}

export async function disconnectFacebookPageConnection(pageId: string, actorEmail: string) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const result = await db.query(
    `UPDATE facebook_page_connections SET active=false,disconnected_at=now(),updated_at=now()
     WHERE page_id=$1 AND active=true RETURNING page_id`,
    [pageId],
  );
  if (result.rowCount) await addAuditLog('system', randomUUID(), 'facebook_page_disconnected', actorEmail, { pageId });
  return Boolean(result.rowCount);
}

export async function recordFacebookWebhookSeen(pageId: string) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  await db.query('UPDATE facebook_page_connections SET last_webhook_at=now(),updated_at=now() WHERE page_id=$1 AND active=true', [pageId]);
}

type StoredWebhookMessage = {
  pageId: string;
  participantId: string;
  providerMessageId: string;
  text: string;
  attachmentTypes: string[];
  providerTimestamp: string;
};

function previewForMessage(text: string, attachmentTypes: string[]) {
  const attachment = attachmentTypes.length ? `Príloha: ${attachmentTypes.join(', ')}` : '';
  return (text || attachment || 'Nová správa').replace(/\s+/g, ' ').trim().slice(0, 240);
}

async function lockConversation(client: PoolClient, pageId: string, participantId: string) {
  const existing = await client.query(
    'SELECT * FROM facebook_conversations WHERE page_id=$1 AND participant_id=$2 FOR UPDATE',
    [pageId, participantId],
  );
  if (existing.rows[0]) return existing.rows[0] as Record<string, unknown>;
  const created = await client.query(
    `INSERT INTO facebook_conversations (id,page_id,participant_id)
     VALUES ($1,$2,$3) ON CONFLICT (page_id,participant_id) DO NOTHING RETURNING *`,
    [randomUUID(), pageId, participantId],
  );
  if (created.rows[0]) return created.rows[0] as Record<string, unknown>;
  const retried = await client.query(
    'SELECT * FROM facebook_conversations WHERE page_id=$1 AND participant_id=$2 FOR UPDATE',
    [pageId, participantId],
  );
  return retried.rows[0] as Record<string, unknown>;
}

export async function storeFacebookInboundMessage(input: StoredWebhookMessage) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const conversation = await lockConversation(client, input.pageId, input.participantId);
    const inserted = await client.query(
      `INSERT INTO facebook_messages (
         id,conversation_id,provider_message_id,direction,message_text,attachment_types,status,provider_timestamp
       ) VALUES ($1,$2,$3,'inbound',$4,$5,'received',$6)
       ON CONFLICT (provider_message_id) WHERE provider_message_id <> '' DO NOTHING
       RETURNING id`,
      [randomUUID(), conversation.id, input.providerMessageId, input.text.slice(0, 8_000), input.attachmentTypes, input.providerTimestamp],
    );
    if (inserted.rowCount) {
      await client.query(
        `UPDATE facebook_conversations SET
           status=CASE WHEN status='vybavena' THEN 'nova' ELSE status END,
           unread_count=unread_count+1,
           last_message_preview=$2,
           last_inbound_at=GREATEST(COALESCE(last_inbound_at,$3),$3),
           last_message_at=GREATEST(last_message_at,$3),updated_at=now()
         WHERE id=$1`,
        [conversation.id, previewForMessage(input.text, input.attachmentTypes), input.providerTimestamp],
      );
    }
    await client.query('COMMIT');
    return { inserted: Boolean(inserted.rowCount), conversationId: String(conversation.id) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function storeFacebookOutboundEcho(input: StoredWebhookMessage) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const conversation = await lockConversation(client, input.pageId, input.participantId);
    const inserted = await client.query(
      `INSERT INTO facebook_messages (
         id,conversation_id,provider_message_id,direction,message_text,attachment_types,status,sent_by,provider_timestamp
       ) VALUES ($1,$2,$3,'outbound',$4,$5,'sent','facebook-external',$6)
       ON CONFLICT (provider_message_id) WHERE provider_message_id <> '' DO NOTHING RETURNING id`,
      [randomUUID(), conversation.id, input.providerMessageId, input.text.slice(0, 8_000), input.attachmentTypes, input.providerTimestamp],
    );
    if (inserted.rowCount) {
      await client.query(
        `UPDATE facebook_conversations SET status='cakame_na_zakaznika',unread_count=0,
         last_message_preview=$2,last_outbound_at=GREATEST(COALESCE(last_outbound_at,$3),$3),
         last_message_at=GREATEST(last_message_at,$3),updated_at=now() WHERE id=$1`,
        [conversation.id, previewForMessage(input.text, input.attachmentTypes), input.providerTimestamp],
      );
    }
    await client.query('COMMIT');
    return Boolean(inserted.rowCount);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFacebookParticipantName(pageId: string, participantId: string, name: string) {
  const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!cleanName) return;
  await ensureFacebookMessengerSchema();
  await requireDatabase().query(
    `UPDATE facebook_conversations SET participant_name=$3,updated_at=now()
     WHERE page_id=$1 AND participant_id=$2`,
    [pageId, participantId, cleanName],
  );
}

export async function markFacebookDelivered(providerMessageIds: string[], readAt?: string) {
  const ids = [...new Set(providerMessageIds.filter(Boolean))].slice(0, 100);
  if (!ids.length) return;
  await ensureFacebookMessengerSchema();
  await requireDatabase().query(
    `UPDATE facebook_messages SET status=$2,updated_at=now()
     WHERE provider_message_id=ANY($1::text[]) AND direction='outbound' AND status IN ('sending','sent','delivered')`,
    [ids, readAt ? 'read' : 'delivered'],
  );
}

export async function markFacebookReadByWatermark(pageId: string, participantId: string, watermark: string) {
  await ensureFacebookMessengerSchema();
  const timestamp = new Date(Number(watermark));
  if (Number.isNaN(timestamp.getTime())) return;
  await requireDatabase().query(
    `UPDATE facebook_messages m SET status='read',updated_at=now()
     FROM facebook_conversations c
     WHERE m.conversation_id=c.id AND c.page_id=$1 AND c.participant_id=$2
       AND m.direction='outbound' AND m.provider_timestamp <= $3 AND m.status IN ('sent','delivered')`,
    [pageId, participantId, timestamp.toISOString()],
  );
}

export async function listFacebookConversations(filter: FacebookMessengerListFilter = {}) {
  await ensureFacebookMessengerSchema();
  const db = getServerDatabasePool();
  if (!db) return [];
  const values: unknown[] = [];
  const where = ['1=1'];
  if (filter.status) { values.push(filter.status); where.push(`status=$${values.length}`); }
  if (filter.assignedTo === 'none') where.push("assigned_to=''");
  else if (filter.assignedTo) { values.push(filter.assignedTo); where.push(`lower(assigned_to)=lower($${values.length})`); }
  if (filter.unreadOnly) where.push('unread_count > 0');
  if (filter.participantId) { values.push(filter.participantId); where.push(`participant_id=$${values.length}`); }
  const result = await db.query(
    `SELECT * FROM facebook_conversations WHERE ${where.join(' AND ')}
     ORDER BY (unread_count > 0) DESC,last_message_at DESC LIMIT 200`,
    values,
  );
  return result.rows.map(toConversation);
}

export async function getFacebookConversationCounts(participantId = ''): Promise<FacebookConversationCounts> {
  await ensureFacebookMessengerSchema();
  const db = getServerDatabasePool();
  if (!db) return { all: 0, unread: 0, unassigned: 0, open: 0, waiting: 0 };
  const result = await db.query(`SELECT COUNT(*)::int AS all,
    COUNT(*) FILTER (WHERE unread_count>0)::int AS unread,
    COUNT(*) FILTER (WHERE assigned_to='')::int AS unassigned,
    COUNT(*) FILTER (WHERE status IN ('nova','riesi_sa'))::int AS open,
    COUNT(*) FILTER (WHERE status='cakame_na_zakaznika')::int AS waiting
    FROM facebook_conversations WHERE ($1='' OR participant_id=$1)`, [participantId]);
  const row = result.rows[0] ?? {};
  return { all: Number(row.all || 0), unread: Number(row.unread || 0), unassigned: Number(row.unassigned || 0), open: Number(row.open || 0), waiting: Number(row.waiting || 0) };
}

export async function getFacebookConversation(id: string, participantId = ''): Promise<FacebookConversationDetail | undefined> {
  await ensureFacebookMessengerSchema();
  const db = getServerDatabasePool();
  if (!db) return undefined;
  const [conversation, messages] = await Promise.all([
    db.query("SELECT * FROM facebook_conversations WHERE id=$1 AND ($2='' OR participant_id=$2) LIMIT 1", [id, participantId]),
    db.query('SELECT * FROM facebook_messages WHERE conversation_id=$1 ORDER BY provider_timestamp ASC,created_at ASC', [id]),
  ]);
  if (!conversation.rows[0]) return undefined;
  return { ...toConversation(conversation.rows[0]), messages: messages.rows.map(toMessage) };
}

export async function updateFacebookConversationWorkflow(input: {
  id: string;
  status: FacebookConversationStatus;
  assignedTo: string;
  actorEmail: string;
}) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const result = await db.query(
    `UPDATE facebook_conversations c SET status=$2,assigned_to=$3,unread_count=0,updated_at=now()
     WHERE c.id=$1 AND ($3='' OR EXISTS (SELECT 1 FROM admin_users u WHERE u.active=true AND lower(u.email)=lower($3)))
     RETURNING id`,
    [input.id, input.status, input.assignedTo],
  );
  if (!result.rowCount) throw new Error('Konverzáciu sa nepodarilo aktualizovať. Skontrolujte pridelenie.');
  await addAuditLog('facebook_conversation', input.id, 'facebook_conversation_workflow_updated', input.actorEmail, {
    status: input.status, assignedTo: input.assignedTo,
  });
}

export async function linkFacebookConversationToLead(id: string, leadId: string, actorEmail: string) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const normalized = leadId.trim();
  const result = await db.query(
    `UPDATE facebook_conversations c SET lead_id=$2,updated_at=now()
     WHERE c.id=$1 AND EXISTS (SELECT 1 FROM leads l WHERE l.id=$2 AND l.deleted_at IS NULL) RETURNING id`,
    [id, normalized],
  );
  if (!result.rowCount) throw new Error('Aktívny dopyt s týmto ID sa nenašiel.');
  await addAuditLog('facebook_conversation', id, 'facebook_conversation_linked_to_lead', actorEmail, { leadId: normalized });
}

export async function unlinkFacebookConversationFromLead(id: string, actorEmail: string) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  await db.query('UPDATE facebook_conversations SET lead_id=NULL,updated_at=now() WHERE id=$1', [id]);
  await addAuditLog('facebook_conversation', id, 'facebook_conversation_unlinked_from_lead', actorEmail, {});
}

export async function prepareFacebookOutboundMessage(input: {
  conversationId: string;
  clientRequestId: string;
  text: string;
  actorEmail: string;
  expectedParticipantId?: string;
}) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const conversationResult = await client.query(
      `SELECT c.*,p.encrypted_page_access_token,
        (c.last_inbound_at IS NOT NULL AND c.last_inbound_at <= now()
          AND c.last_inbound_at >= now() - interval '24 hours') AS reply_window_open
       FROM facebook_conversations c
       JOIN facebook_page_connections p ON p.page_id=c.page_id AND p.active=true
       WHERE c.id=$1 AND ($2='' OR c.participant_id=$2) FOR UPDATE`,
      [input.conversationId, input.expectedParticipantId || ''],
    );
    const row = conversationResult.rows[0];
    if (!row) throw new Error('Facebook konverzácia alebo aktívne pripojenie sa nenašli.');
    if (row.reply_window_open !== true) throw new Error('24-hodinové okno na bežnú Facebook odpoveď už uplynulo.');
    const unresolved = await client.query(
      "SELECT 1 FROM facebook_messages WHERE conversation_id=$1 AND direction='outbound' AND status='unknown' LIMIT 1",
      [input.conversationId],
    );
    if (unresolved.rowCount) throw new Error('Najprv overte neistý výsledok predchádzajúceho odoslania.');
    const existing = await client.query('SELECT * FROM facebook_messages WHERE client_request_id=$1 LIMIT 1', [input.clientRequestId]);
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return { duplicate: true, conversation: toConversation(row), message: toMessage(existing.rows[0]), encryptedPageAccessToken: String(row.encrypted_page_access_token) };
    }
    const inserted = await client.query(
      `INSERT INTO facebook_messages (
         id,conversation_id,client_request_id,direction,message_text,status,sent_by,provider_timestamp
       ) VALUES ($1,$2,$3,'outbound',$4,'sending',$5,now()) RETURNING *`,
      [randomUUID(), input.conversationId, input.clientRequestId, input.text, input.actorEmail],
    );
    await client.query('COMMIT');
    return { duplicate: false, conversation: toConversation(row), message: toMessage(inserted.rows[0]), encryptedPageAccessToken: String(row.encrypted_page_access_token) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function resolveFacebookUnknownMessage(input: {
  conversationId: string;
  messageId: string;
  outcome: 'sent' | 'failed';
  evidence: string;
  actorEmail: string;
}) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE facebook_messages SET status=$3,error_code=$4,updated_at=now()
       WHERE id=$1 AND conversation_id=$2 AND direction='outbound' AND status='unknown'
       RETURNING message_text,provider_timestamp`,
      [input.messageId, input.conversationId, input.outcome, `manual_${input.outcome}`],
    );
    if (!updated.rowCount) throw new Error('Neistý výsledok sa nenašiel alebo už bol vyriešený.');
    if (input.outcome === 'sent') {
      await client.query(
        `UPDATE facebook_conversations SET status='cakame_na_zakaznika',unread_count=0,
         last_message_preview=$2,last_outbound_at=$3,last_message_at=GREATEST(last_message_at,$3),updated_at=now()
         WHERE id=$1`,
        [input.conversationId, previewForMessage(String(updated.rows[0].message_text), []), updated.rows[0].provider_timestamp],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await addAuditLog('facebook_conversation', input.conversationId, 'facebook_unknown_delivery_resolved', input.actorEmail, {
    messageId: input.messageId,
    outcome: input.outcome,
    evidence: input.evidence.slice(0, 500),
  });
}

export async function completeFacebookOutboundMessage(input: {
  messageId: string;
  conversationId: string;
  status: Extract<FacebookMessageStatus, 'sent' | 'failed' | 'unknown'>;
  providerMessageId?: string;
  errorCode?: string;
  actorEmail: string;
}) {
  await ensureFacebookMessengerSchema();
  const db = requireDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE facebook_messages SET status=$2,provider_message_id=$3,error_code=$4,updated_at=now()
       WHERE id=$1 AND status='sending' RETURNING message_text,provider_timestamp`,
      [input.messageId, input.status, input.providerMessageId || '', input.errorCode || ''],
    );
    if (updated.rowCount && input.status === 'sent') {
      const message = updated.rows[0];
      await client.query(
        `UPDATE facebook_conversations SET status='cakame_na_zakaznika',unread_count=0,
         last_message_preview=$2,last_outbound_at=$3,last_message_at=GREATEST(last_message_at,$3),updated_at=now()
         WHERE id=$1`,
        [input.conversationId, previewForMessage(String(message.message_text), []), message.provider_timestamp],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await addAuditLog('facebook_conversation', input.conversationId, `facebook_message_${input.status}`, input.actorEmail, {
    messageId: input.messageId, providerMessageId: input.providerMessageId || '', errorCode: input.errorCode || '',
  });
}
