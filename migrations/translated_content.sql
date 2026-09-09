CREATE TABLE IF NOT EXISTS translated_content (
  id BIGSERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  field TEXT NOT NULL,
  into_language TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  engine TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, field, into_language)
);

CREATE INDEX IF NOT EXISTS translated_content_lookup
  ON translated_content (content_type, content_id, into_language);
