CREATE TABLE IF NOT EXISTS media_files (
  key TEXT PRIMARY KEY NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  original_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_chunks (
  file_key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (file_key, chunk_index),
  FOREIGN KEY (file_key) REFERENCES media_files(key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_files_created ON media_files(created_at DESC);
