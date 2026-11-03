import 'server-only';

// biome-ignore lint/correctness/noNodejsModules: runs on server
import fs from 'node:fs';
// biome-ignore lint/correctness/noNodejsModules: runs on server
import path from 'node:path';
import type { Database as BetterSql3Database } from 'better-sqlite3-multiple-ciphers';
import Database from 'better-sqlite3-multiple-ciphers';
import { NOTIFICATIONS_DB_PATH } from './env';

export enum NOTIFICATIONS_TABLE {
  PUSH_SUBSCRIPTIONS = 'push_subscriptions',
  SUBSCRIPTION_ADDRESSES = 'subscription_addresses',
  NODE_STATE = 'node_state',
}

export interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: number;
  /** Last time this subscription was seen in a client-initiated request; used for expiry. */
  last_seen_at: number;
}

export interface SubscriptionAddressRow {
  subscription_id: number;
  address: string;
  created_at: number;
}

export interface NodeStateRow {
  address: string;
  pubkey_bls: string;
  state: string;
  updated_at: number;
}

const CREATE_PUSH_SUBSCRIPTIONS = `
  CREATE TABLE IF NOT EXISTS ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL DEFAULT 0
  );
`;

const CREATE_SUBSCRIPTION_ADDRESSES = `
  CREATE TABLE IF NOT EXISTS ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} (
    subscription_id INTEGER NOT NULL REFERENCES ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS}(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (subscription_id, address)
  );
`;

const CREATE_SUBSCRIPTION_ADDRESSES_INDEX = `
  CREATE INDEX IF NOT EXISTS subscription_addresses_address_idx
  ON ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} (address);
`;

const CREATE_NODE_STATE = `
  CREATE TABLE IF NOT EXISTS ${NOTIFICATIONS_TABLE.NODE_STATE} (
    address TEXT NOT NULL,
    pubkey_bls TEXT NOT NULL,
    state TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (address, pubkey_bls)
  );
`;

const NATIVE_BINDING_PATH = path.resolve(
  process.cwd(),
  'node_modules',
  'better-sqlite3-multiple-ciphers',
  'build',
  'Release',
  'better_sqlite3.node'
);

function resolveDbPath() {
  return path.isAbsolute(NOTIFICATIONS_DB_PATH)
    ? NOTIFICATIONS_DB_PATH
    : path.resolve(process.cwd(), NOTIFICATIONS_DB_PATH);
}

export const openNotificationsDatabase = (): BetterSql3Database => {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, { nativeBinding: NATIVE_BINDING_PATH });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
};

export const setupNotificationsDatabase = () => {
  const db = openNotificationsDatabase();
  db.exec(CREATE_PUSH_SUBSCRIPTIONS);
  db.exec(CREATE_SUBSCRIPTION_ADDRESSES);
  db.exec(CREATE_SUBSCRIPTION_ADDRESSES_INDEX);
  db.exec(CREATE_NODE_STATE);
  migrateLastSeenAt(db);
  db.close();
};

/** Adds the `last_seen_at` column to databases created before it existed. */
function migrateLastSeenAt(db: BetterSql3Database) {
  const columns = db
    .prepare(`PRAGMA table_info(${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS})`)
    .all() as Array<{ name: string }>;

  if (columns.some((column) => column.name === 'last_seen_at')) return;

  db.exec(
    `ALTER TABLE ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0`
  );
  db.exec(
    `UPDATE ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} SET last_seen_at = created_at WHERE last_seen_at = 0`
  );
}
