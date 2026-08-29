-- Up Migration

-- ── Scheme applications: a farmer applies for a scheme, an officer works it ──
CREATE TABLE scheme_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id     UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  farmer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted','under_review','approved','rejected','disbursed')),
  farmer_note   TEXT,
  officer_note  TEXT,
  amount        NUMERIC,                 -- rupees actually disbursed
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scheme_id, farmer_id)
);
CREATE INDEX scheme_apps_farmer_idx ON scheme_applications (farmer_id);
CREATE INDEX scheme_apps_status_idx ON scheme_applications (status);
CREATE INDEX scheme_apps_scheme_idx ON scheme_applications (scheme_id);

-- ── Query threads (farmer <-> officer conversation about a scheme) ──
CREATE TABLE scheme_threads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id      UUID REFERENCES schemes(id) ON DELETE SET NULL,
  application_id UUID REFERENCES scheme_applications(id) ON DELETE SET NULL,
  farmer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','answered','closed')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scheme_threads_farmer_idx ON scheme_threads (farmer_id);
CREATE INDEX scheme_threads_status_idx ON scheme_threads (status, last_message_at DESC);

CREATE TABLE scheme_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES scheme_threads(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('farmer','official')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scheme_messages_thread_idx ON scheme_messages (thread_id, created_at);

-- Down Migration
DROP TABLE IF EXISTS scheme_messages;
DROP TABLE IF EXISTS scheme_threads;
DROP TABLE IF EXISTS scheme_applications;
