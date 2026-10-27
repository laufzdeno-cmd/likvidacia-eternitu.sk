export type JobMailConfiguration = { enabled: boolean; labelIds: string[]; since: string; maxMessages: number; verificationAcknowledged: boolean; revision: number; updatedAt: string | null; updatedBy: string | null };
export type JobMailPdfAttachment = { attachmentId: string; filename: string; mime: 'application/pdf'; size: number };
export type JobMailMessage = { messageId: string; threadId: string; occurredAt: string; subject: string; text: string; sender: string; recipients: string[]; direction: 'INBOUND' | 'OUTBOUND'; pdfAttachments: JobMailPdfAttachment[] };
export type JobMailMatchCandidate = { jobId: string; number: string; email: string; phone: string; offerNumbers: string[] };
export type JobMailMatch = { jobId: string; reasons: string[]; strength: 'EXACT_OFFER' | 'CONTACT_ONLY' };
export type JobMailStagedMessage = JobMailMessage & { id: string; account: string; importedAt: string; matches: JobMailMatch[]; review: 'PENDING' | 'LINKED' | 'IGNORED'; linkedJobId: string | null; reviewedAt: string | null; reviewedBy: string | null; attachmentDocuments?: Record<string, string> };
export type JobMailStore = { configuration: JobMailConfiguration; messages: JobMailStagedMessage[]; pageTokens: Record<string, string> };
