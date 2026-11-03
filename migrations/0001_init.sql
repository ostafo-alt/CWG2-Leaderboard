-- CWG2 leaderboard schema (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS players (
  user_hash   INTEGER PRIMARY KEY,          -- the save's account hash (same number in every file name)
  battletag   TEXT,                         -- taken from ACCOUNT_/ENTITLEMENTS_/LEGACY_ file names
  first_seen  INTEGER NOT NULL,             -- ms since epoch
  updated_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS heroes (
  user_hash     INTEGER NOT NULL REFERENCES players(user_hash) ON DELETE CASCADE,
  family        INTEGER NOT NULL,           -- class slot 1..26
  class_name    TEXT NOT NULL,
  hero_id       TEXT NOT NULL,              -- hero form rawcode, e.g. H0GG
  tier          INTEGER,
  generation    INTEGER NOT NULL,           -- how many times the hero was saved in game
  exp           INTEGER NOT NULL,
  gold          INTEGER NOT NULL,
  lum           INTEGER NOT NULL,
  strength      INTEGER NOT NULL,
  agility       INTEGER NOT NULL,
  intelligence  INTEGER NOT NULL,
  primary_stat  TEXT,
  primary_value INTEGER NOT NULL,
  items         TEXT NOT NULL,              -- JSON list of the 6 equipped item rawcodes
  file_mtime    INTEGER,
  uploaded_at   INTEGER NOT NULL,
  PRIMARY KEY (user_hash, family)
);
CREATE INDEX IF NOT EXISTS heroes_user ON heroes(user_hash);
CREATE TABLE IF NOT EXISTS save_files (
  user_hash   INTEGER NOT NULL REFERENCES players(user_hash) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  content     TEXT NOT NULL,                -- the raw .pld text, latest upload only
  file_mtime  INTEGER,
  uploaded_at INTEGER NOT NULL,
  PRIMARY KEY (user_hash, filename)
);
