-- BG-4 D1 schema for the shared WhatsApp invoice STATUS gateway.
-- Per Codex review: installations store a PUBLIC KEY (ECDSA), not a secret hash (#1);
-- message_mappings/message_status keep installation_id NULLABLE so status webhooks that
-- arrive before register are retained and reconciled later (#4); customer_service_windows
-- backs the /window lookup (#3). No invoice files, no Meta send tokens here.

CREATE TABLE tenants (
  tenant_id           TEXT PRIMARY KEY,
  restaurant_name     TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  allow_paid_template INTEGER NOT NULL DEFAULT 0,
  window_salt         TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE phone_numbers (
  phone_number_id     TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenants(tenant_id),
  masked_display_number TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX ix_phone_numbers_tenant ON phone_numbers(tenant_id);

CREATE TABLE installations (
  installation_id     TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenants(tenant_id),
  branch_id           TEXT,
  public_key          TEXT NOT NULL,           -- base64 SPKI (ECDSA P-256) — NOT a shared secret
  key_id              TEXT,
  key_status          TEXT NOT NULL DEFAULT 'active',
  status              TEXT NOT NULL DEFAULT 'active',
  last_seen_at        TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX ix_installations_tenant ON installations(tenant_id, installation_id);

CREATE TABLE message_mappings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id           TEXT NOT NULL,
  installation_id     TEXT,                    -- NULLABLE until register links it
  local_job_id        TEXT,
  invoice_id_hash     TEXT,
  meta_message_id     TEXT NOT NULL UNIQUE,
  phone_number_id     TEXT,
  created_at          TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_mappings_tenant_job ON message_mappings(tenant_id, local_job_id);

CREATE TABLE webhook_events (
  event_id            TEXT PRIMARY KEY,        -- payload_hash (idempotent)
  tenant_id           TEXT,
  phone_number_id     TEXT,
  meta_message_id     TEXT,
  event_type          TEXT,
  status_rank         INTEGER,
  event_timestamp     TEXT,
  received_at         TEXT NOT NULL,
  expires_at          TEXT
);
CREATE INDEX ix_events_msg ON webhook_events(meta_message_id, event_timestamp);

CREATE TABLE message_status (
  meta_message_id     TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  installation_id     TEXT,                    -- NULLABLE until reconciled at register
  current_status      TEXT NOT NULL,
  status_rank         INTEGER NOT NULL,
  error_code          TEXT,
  error_message_redacted TEXT,
  sent_at             TEXT,
  delivered_at        TEXT,
  read_at             TEXT,
  failed_at           TEXT,
  updated_at          TEXT NOT NULL
);
CREATE INDEX ix_status_tenant_updated ON message_status(tenant_id, updated_at);
CREATE INDEX ix_status_install_updated ON message_status(installation_id, updated_at);

CREATE TABLE customer_service_windows (
  tenant_id               TEXT NOT NULL,
  phone_number_id         TEXT,
  customer_wa_id_hash     TEXT NOT NULL,
  last_customer_message_at TEXT NOT NULL,
  window_expires_at       TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  PRIMARY KEY (tenant_id, customer_wa_id_hash)
);

-- replay protection for installation-authenticated requests
CREATE TABLE auth_nonces (
  nonce      TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  seen_at    TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX ix_nonces_expiry ON auth_nonces(expires_at);
