PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  reward_amount_paisa INTEGER NOT NULL CHECK (reward_amount_paisa >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS mechanics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','scanned','disabled')),
  mechanic_name TEXT,
  scanned_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_code_id INTEGER NOT NULL UNIQUE REFERENCES qr_codes(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  mechanic_name TEXT NOT NULL,
  reward_amount_paisa INTEGER NOT NULL,
  scanned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archived_scans (
  id INTEGER PRIMARY KEY,
  mechanic_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  reward_amount_paisa INTEGER NOT NULL,
  scanned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retired_qr_tokens (
  token TEXT PRIMARY KEY,
  retired_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS reward_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mechanic_name TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
  notes TEXT,
  paid_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_product ON qr_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_scans_mechanic ON scans(mechanic_name);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at);

CREATE TRIGGER IF NOT EXISTS record_successful_qr_scan
AFTER UPDATE OF status ON qr_codes
WHEN OLD.status = 'unused' AND NEW.status = 'scanned'
BEGIN
  INSERT INTO scans (qr_code_id, product_id, mechanic_name, reward_amount_paisa, scanned_at)
  SELECT NEW.id, p.id, NEW.mechanic_name, p.reward_amount_paisa, NEW.scanned_at
  FROM products p
  WHERE p.id = NEW.product_id;
END;
