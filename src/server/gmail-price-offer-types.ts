export type GmailPriceOfferJobStatus = 'pending' | 'processing' | 'retry' | 'completed' | 'attention';

export type GmailPriceOfferConnection = {
  emailAddress: string;
  active: boolean;
  labelId: string;
  labelName: string;
  connectedBy: string;
  connectedAt: string;
  tokenValidatedAt?: string;
  lastSuccessAt?: string;
  lastErrorCode: string;
};

export type GmailPriceOfferJobSummary = {
  pending: number;
  processing: number;
  retry: number;
  completed: number;
  attention: number;
};

export type GmailPriceOfferJobView = {
  status: GmailPriceOfferJobStatus;
  attempts: number;
  lastErrorCode: string;
  completedAt?: string;
  updatedAt: string;
};

export type GmailPriceOfferJobClaim = {
  id: string;
  offerId: string;
  rfc822MessageId: string;
  claimToken: string;
  attempts: number;
};
