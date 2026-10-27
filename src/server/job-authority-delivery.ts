import { claimAuthorityNotice, finalizeAuthorityNotice } from './job-workspace-db';
import { sendPlannerNotificationEmail } from './mail';
import type { AuthorityNotice, JobWorkspaceActor } from './job-workspace-types';
import { assertJobWorkspaceEnabled } from './job-workspace-feature';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export type AuthorityDeliveryDependencies = {
  claim: typeof claimAuthorityNotice;
  finalize: typeof finalizeAuthorityNotice;
  send: typeof sendPlannerNotificationEmail;
};
const dependencies: AuthorityDeliveryDependencies = { claim: claimAuthorityNotice, finalize: finalizeAuthorityNotice, send: sendPlannerNotificationEmail };

/** Only an explicitly approved immutable preview can claim a single mail attempt. */
export async function deliverApprovedAuthorityNotice(id: string, actor: JobWorkspaceActor, deps = dependencies): Promise<{ state: AuthorityNotice['state'] | 'ALREADY_HANDLED' }> {
  assertJobWorkspaceEnabled();
  const notice = await deps.claim(id, actor);
  if (!notice || !notice.attemptId) return { state: 'ALREADY_HANDLED' };
  let state: 'SENT' | 'FAILED' | 'UNCERTAIN' = 'UNCERTAIN';
  try {
    const response = await deps.send({ to: notice.recipient, subject: notice.subject, text: notice.text, html: `<div style="background:#f0f7fa;padding:24px;font-family:Arial,sans-serif;color:#193c51"><div style="max-width:640px;margin:auto;background:white;border-radius:12px;padding:28px"><p style="color:#126b66;font-weight:bold">ASTANA · Informácia k zákazke</p><h1 style="font-size:24px;line-height:1.3">${escape(notice.subject)}</h1><div style="white-space:pre-line;line-height:1.7">${escape(notice.text)}</div></div></div>`, purpose: 'JOB_AUTHORITY' });
    state = response.sent ? 'SENT' : response.status === 'failed' ? 'FAILED' : 'UNCERTAIN';
  } catch {
    // Unknown transport result must never return to PREPARED or be blindly retried.
    state = 'UNCERTAIN';
  }
  await deps.finalize(notice.id, notice.attemptId, state, actor);
  return { state };
}
