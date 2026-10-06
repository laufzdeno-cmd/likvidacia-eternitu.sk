import type { LeadDeliveryMode } from './astana-local-relay';

export type LeadMailHealth = {
  level: 'ok' | 'warning' | 'error';
  label: string;
  detail: string;
};

export function describeLeadMailHealth(
  mode: LeadDeliveryMode,
  smtpAttemptConfigured: boolean,
  smtpConnected: boolean,
  relayConfigured: boolean,
): LeadMailHealth {
  if (mode === 'local_relay') {
    return relayConfigured
      ? {
          level: 'warning',
          label: 'Relay nastavený',
          detail: 'Aktívny je ASTANA relay. Jeho dostupnosť ani doručenie do schránky táto kontrola neoveruje; samostatné opakovanie adresátovi vyžaduje SMTP.',
        }
      : {
          level: 'error',
          label: 'Relay chýba',
          detail: 'Aktívny je ASTANA relay, ale jeho povolené nastavenie chýba. Doručenie dopytových emailov nie je pripravené.',
        };
  }

  if (smtpConnected) {
    return {
      level: 'ok',
      label: 'SMTP odpovedá',
      detail: mode === 'smtp_then_local_relay' && relayConfigured
        ? 'Primárne SMTP spojenie odpovedá a záložný relay je nastavený. Doručenie do schránky musí potvrdiť osobitný test.'
        : 'Aktívne SMTP spojenie odpovedá. Doručenie do schránky musí potvrdiť osobitný test.',
    };
  }

  if (mode === 'smtp_then_local_relay' && relayConfigured && !smtpAttemptConfigured) {
    return {
      level: 'warning',
      label: 'Relay pri chýbajúcom SMTP',
      detail: 'SMTP nie je nastavené, takže sa použije záložný ASTANA relay. Jeho dostupnosť a doručenie do schránky nie sú overené.',
    };
  }

  if (mode === 'smtp_then_local_relay' && smtpAttemptConfigured) {
    return {
      level: 'error',
      label: 'SMTP neoverené',
      detail: 'SMTP má nastavené základné údaje, ale bezpečné spojenie nie je overené. Po neistom SMTP pokuse sa relay automaticky nespustí, aby nevznikol duplicitný email.',
    };
  }

  return {
    level: 'error',
    label: 'Odosielanie neoverené',
    detail: mode === 'smtp_then_local_relay'
      ? 'SMTP spojenie nie je overené a záložný relay nie je pripravený. Dopytové emaily vyžadujú nápravu.'
      : 'Aktívne SMTP spojenie nie je overené. Dopytové emaily vyžadujú nápravu.',
  };
}
