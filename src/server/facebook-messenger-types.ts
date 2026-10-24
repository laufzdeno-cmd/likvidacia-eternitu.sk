export type FacebookConversationStatus = 'nova' | 'riesi_sa' | 'cakame_na_zakaznika' | 'vybavena';
export type FacebookMessageDirection = 'inbound' | 'outbound';
export type FacebookMessageStatus = 'received' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';

export type FacebookPageConnection = {
  pageId: string;
  pageName: string;
  active: boolean;
  connectedBy: string;
  connectedAt: string;
  disconnectedAt?: string;
  tokenValidatedAt?: string;
  lastWebhookAt?: string;
};
export type FacebookConversation = {
  id: string;
  pageId: string;
  participantId: string;
  participantName: string;
  status: FacebookConversationStatus;
  assignedTo: string;
  leadId?: string;
  unreadCount: number;
  lastMessagePreview: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export type FacebookMessage = {
  id: string;
  conversationId: string;
  providerMessageId: string;
  clientRequestId?: string;
  direction: FacebookMessageDirection;
  text: string;
  attachmentTypes: string[];
  status: FacebookMessageStatus;
  sentBy: string;
  errorCode: string;
  providerTimestamp: string;
  createdAt: string;
  updatedAt: string;
};

export type FacebookConversationDetail = FacebookConversation & {
  messages: FacebookMessage[];
};

export type FacebookConversationCounts = {
  all: number;
  unread: number;
  unassigned: number;
  open: number;
  waiting: number;
};

export type FacebookMessengerListFilter = {
  status?: FacebookConversationStatus;
  assignedTo?: string;
  unreadOnly?: boolean;
};
