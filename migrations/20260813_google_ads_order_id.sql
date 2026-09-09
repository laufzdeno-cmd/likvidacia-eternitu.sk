BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_ads_order_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_google_ads_order_id
  ON leads (google_ads_order_id)
  WHERE google_ads_order_id IS NOT NULL AND google_ads_order_id <> '';

CREATE TABLE IF NOT EXISTS astana_google_ads_order_counters (
  order_date text NOT NULL,
  domain_code text NOT NULL,
  last_value integer NOT NULL,
  PRIMARY KEY (order_date, domain_code),
  CHECK (last_value BETWEEN 1 AND 999999)
);

COMMIT;
