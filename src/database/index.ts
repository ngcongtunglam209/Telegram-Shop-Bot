import { Database } from 'bun:sqlite';
import { DB_PATH } from '../config.js';

export const db = new Database(DB_PATH, { create: true });

db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

db.run(`
  CREATE TABLE IF NOT EXISTS categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE,
    emoji TEXT    NOT NULL DEFAULT ''
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    price_vnd   INTEGER NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT -1,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// Drop legacy price_usdt column if it exists (migration for older DBs)
try { db.run('ALTER TABLE products DROP COLUMN price_usdt'); } catch {}

db.run(`
  CREATE TABLE IF NOT EXISTS product_keys (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    key_value  TEXT    NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    order_id   INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY,
    username   TEXT,
    first_name TEXT    NOT NULL DEFAULT '',
    language   TEXT    NOT NULL DEFAULT 'en',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migration for existing DBs
try { db.run("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en'"); } catch {}

db.run(`
  CREATE TABLE IF NOT EXISTS cart_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity   INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, product_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    payment_method TEXT    NOT NULL DEFAULT 'sepay',
    total_vnd      INTEGER NOT NULL DEFAULT 0,
    total_usdt     INTEGER NOT NULL DEFAULT 0,
    status         TEXT    NOT NULL DEFAULT 'pending',
    payment_ref    TEXT,
    expired_at     TEXT,
    paid_at        TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL DEFAULT 1,
    price_vnd  INTEGER NOT NULL DEFAULT 0,
    price_usdt INTEGER NOT NULL DEFAULT 0
  )
`);
