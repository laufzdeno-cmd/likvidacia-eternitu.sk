import { addAuditLog } from './db';
import {
  ensureGmailPriceOfferLabel,
  findExactSentGmailMessage,
  GmailPriceOfferApiError,
  markGmailMessageAsSentPriceOffer,
  refreshGmailAccessToken,
} from './gmail-price-offer-api';
import { decryptGmailSecret, getGmailPriceOfferConfiguration, gmailPriceOfferLabelName } from './gmail-price-offer-config';
import {
  claimDueGmailPriceOfferJobs,
  completeGmailPriceOfferJob,
  getGmailPriceOfferConnectionSecret,
  recordGmailConnectionResult,
  updateGmailConnectionLabel,
} from './gmail-price-offer-db';
import { gmailErrorCode } from './gmail-price-offer-policy';

export type GmailPriceOfferDispatchResult = {
  configured: boolean;
  connected: boolean;
  claimed: number;
  completed: number;
  retry: number;
  attention: number;
};

export async function dispatchGmailPriceOfferLabels(limit = 10): Promise<GmailPriceOfferDispatchResult> {
  const result: GmailPriceOfferDispatchResult = {
    configured: false, connected: false, claimed: 0, completed: 0, retry: 0, attention: 0,
  };
  const config = getGmailPriceOfferConfiguration();
  if (!config.configured || !config.encryptionKey) return result;
  result.configured = true;
  const secret = await getGmailPriceOfferConnectionSecret();
  if (!secret) return result;
  result.connected = true;

  let accessToken = '';
  let labelId = '';
  try {
    const refreshToken = decryptGmailSecret(secret.encryptedRefreshToken, config.encryptionKey);
    accessToken = await refreshGmailAccessToken(refreshToken);
    labelId = await ensureGmailPriceOfferLabel(accessToken);
    if (labelId !== secret.connection.labelId || secret.connection.labelName !== gmailPriceOfferLabelName) {
      await updateGmailConnectionLabel(labelId, gmailPriceOfferLabelName);
    }
    await recordGmailConnectionResult(true);
  } catch (error) {
    const code = error instanceof GmailPriceOfferApiError ? error.code : 'gmail_connection_failed';
    await recordGmailConnectionResult(false, code);
    return result;
  }

  const jobs = await claimDueGmailPriceOfferJobs(limit);
  result.claimed = jobs.length;
  for (const job of jobs) {
    try {
      const match = await findExactSentGmailMessage(accessToken, job.rfc822MessageId);
      if (match.status === 'not_found') {
        await completeGmailPriceOfferJob({
          id: job.id, claimToken: job.claimToken, outcome: 'retry', attempts: job.attempts,
          errorCode: 'gmail_message_not_indexed',
        });
        result.retry += 1;
        continue;
      }
      if (match.status === 'ambiguous') {
        await completeGmailPriceOfferJob({
          id: job.id, claimToken: job.claimToken, outcome: 'attention', attempts: job.attempts,
          errorCode: 'gmail_message_ambiguous',
        });
        result.attention += 1;
        continue;
      }
      await markGmailMessageAsSentPriceOffer(accessToken, match.messageId, labelId);
      const offerId = await completeGmailPriceOfferJob({
        id: job.id, claimToken: job.claimToken, outcome: 'completed', attempts: job.attempts,
        gmailMessageId: match.messageId,
      });
      if (offerId) {
        await addAuditLog('system', offerId, 'gmail_price_offer_label_completed', 'cron:gmail-price-offers', {
          attempt: job.attempts,
        });
      }
      result.completed += 1;
    } catch (error) {
      const code = gmailErrorCode(error instanceof GmailPriceOfferApiError ? error.code : 'gmail_job_failed');
      const retryable = error instanceof GmailPriceOfferApiError ? error.retryable : true;
      await completeGmailPriceOfferJob({
        id: job.id, claimToken: job.claimToken, outcome: retryable ? 'retry' : 'attention',
        attempts: job.attempts, errorCode: code,
      });
      result[retryable ? 'retry' : 'attention'] += 1;
      if (!retryable && (code === 'gmail_authorization_failed' || code === 'oauth_reauthorization_required')) {
        await recordGmailConnectionResult(false, code);
      }
    }
  }
  return result;
}
