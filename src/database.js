const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(process.cwd(), 'bot.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS tickets (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL,
  claimed_by TEXT,
  created_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  autoclose_enabled INTEGER NOT NULL DEFAULT 1,
  closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tickets_open ON tickets(guild_id, closed_at);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS giveaways (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  winners_count INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  ended INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY(message_id, user_id)
);
`);

module.exports = db;
