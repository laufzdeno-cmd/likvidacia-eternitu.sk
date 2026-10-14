import nodemailer from 'nodemailer';
import { classifyRequiredSmtpRecipient, classifySmtpError } from './email-delivery-policy';
import { resolveOutboundEmailRecipient } from './mail';
import { renderReviewRequestMessage } from './review-request-policy';
import type { ReviewRequest } from './types';

const fromEmail = () => process.env.FROM_EMAIL || process.env.MAIL_FROM || 'astana@astana.sk';
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk').replace(/\/$/, '');

function configuredTransport() {
  if (!process.env.SMTP_HOST || !fromEmail()) return null;
  if (process.env.SMTP_USER?.trim() && !process.env.SMTP_PASS?.trim()) return null;
  const address = fromEmail().match(/<([^>]+)>/)?.[1] || fromEmail();
  if (address.split('@')[1]?.toLowerCase() !== 'astana.sk') throw new Error('REVIEW_MAIL_INVALID_SENDER');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function htmlBody(text: string, link: string) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 16px;color:#263451;font-size:15px;line-height:1.65;">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;font-family:Arial,sans-serif;"><tr><td style="padding:24px 12px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;background:#fff;border:1px solid #dce7ec;"><tr><td style="background:#0f1f3d;padding:24px 28px;color:#fff;font-size:24px;font-weight:700;">ASTANA</td></tr><tr><td style="padding:28px;">${paragraphs}<p style="margin:22px 0;text-align:center;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1768e5;color:#fff;padding:14px 24px;border-radius:9px;font-size:15px;font-weight:700;text-decoration:none;">Napísať referenciu</a></p><p style="margin:20px 0 0;color:#687284;font-size:12px;line-height:1.55;">Odkaz je súkromný a platí 30 dní. Neposielajte ho ďalším osobám.</p></td></tr></table></td></tr></table>`;
}

export async function sendReviewRequestEmail(
  request: ReviewRequest,
  token: string,
  template: string,
  options: { reminder?: boolean } = {},
) {
  let sendAttempted = false;
  try {
    const transport = configuredTransport();
    if (!transport) return { status: 'delivery_failed' as const, reasonCode: 'smtp_unconfigured' };
    const link = `${siteUrl()}/recenzie/${encodeURIComponent(token)}/`;
    const text = renderReviewRequestMessage(request, link, template);
    const recipient = resolveOutboundEmailRecipient(request.customerEmail);
    sendAttempted = true;
    const info = await transport.sendMail({
      from: `ASTANA spätná väzba <${(fromEmail().match(/<([^>]+)>/)?.[1] || fromEmail())}>`,
      to: recipient,
      replyTo: 'astana@astana.sk',
      subject: options.reminder ? `Pripomenutie: ${request.subject}` : request.subject,
      text,
      html: htmlBody(text, link),
    });
    const accepted = classifyRequiredSmtpRecipient(info, recipient);
    // SMTP acceptance proves only that the configured relay accepted the message,
    // not that it reached the customer's inbox.
    if (accepted === 'sent') return { status: 'smtp_accepted' as const, messageId: info.messageId || '' };
    if (accepted === 'failed') return { status: 'delivery_failed' as const, reasonCode: 'smtp_recipient_rejected', messageId: info.messageId || '' };
    return { status: 'delivery_unknown' as const, reasonCode: 'smtp_acceptance_unknown', messageId: info.messageId || '' };
  } catch (error) {
    if (!sendAttempted) {
      return {
        status: 'delivery_failed' as const,
        reasonCode: error instanceof Error && error.message === 'REVIEW_MAIL_INVALID_SENDER'
          ? 'smtp_invalid_sender'
          : 'smtp_configuration_failed',
      };
    }
    const classified = classifySmtpError(error);
    return classified === 'unknown'
      ? { status: 'delivery_unknown' as const, reasonCode: 'smtp_result_unknown' }
      : { status: 'delivery_failed' as const, reasonCode: 'smtp_send_failed' };
  }
}
