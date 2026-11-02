ALTER TABLE content_items ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'scheduled'));
ALTER TABLE content_items ADD COLUMN publish_at TEXT;
CREATE INDEX IF NOT EXISTS idx_content_items_public_status ON content_items(type, status, publish_at, sort_order, created_at DESC);
