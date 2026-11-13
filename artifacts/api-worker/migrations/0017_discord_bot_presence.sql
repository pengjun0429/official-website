CREATE TABLE discord_bot_presence_settings (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('custom', 'playing', 'watching', 'listening', 'competing')),
  activity_text TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_by_name TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
