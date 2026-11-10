import 'server-only';

import type { PushSubscriptionRow } from './db';
import { NOTIFICATIONS_TABLE, openNotificationsDatabase, setupNotificationsDatabase } from './db';

/**
 * A single browser push subscription can watch at most this many addresses.
 */
export const MAX_ADDRESSES_PER_SUBSCRIPTION = 50;

/**
 * The store will accept at most this many push subscriptions.
 */
export const MAX_SUBSCRIPTIONS = 50_000;

export type SubscriptionId = number;

let initialised = false;

function withDb<T>(fn: (db: ReturnType<typeof openNotificationsDatabase>) => T): T {
  if (!initialised) {
    setupNotificationsDatabase();
    initialised = true;
  }
  const db = openNotificationsDatabase();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function normaliseAddress(address: string) {
  return address.toLowerCase();
}

export function countSubscriptions(): number {
  return withDb((db) => {
    const row = db
      .prepare(`SELECT COUNT(*) AS count FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS}`)
      .get() as { count: number };
    return row.count;
  });
}

/**
 * Inserts or updates the push subscription for an endpoint, returning the
 * subscription id. Returns `null` if the subscription cap has been reached and
 * the endpoint is not already known.
 */
export function upsertSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): SubscriptionId | null {
  return withDb((db) => {
    const existing = db
      .prepare(`SELECT id FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE endpoint = ?`)
      .get(input.endpoint) as { id: number } | undefined;

    if (existing) {
      db.prepare(
        `UPDATE ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} SET p256dh = ?, auth = ?, last_seen_at = ? WHERE id = ?`
      ).run(input.p256dh, input.auth, Date.now(), existing.id);
      return existing.id;
    }

    if (countSubscriptionsUncached(db) >= MAX_SUBSCRIPTIONS) {
      return null;
    }

    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} (endpoint, p256dh, auth, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.endpoint, input.p256dh, input.auth, now, now);

    return Number(result.lastInsertRowid);
  });
}

function countSubscriptionsUncached(db: ReturnType<typeof openNotificationsDatabase>) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS}`)
    .get() as { count: number };
  return row.count;
}

/**
 * Links an address to a push subscription. Returns `false` if the address is
 * already linked or the per-subscription address cap has been reached.
 */
export function linkAddress(subscriptionId: SubscriptionId, address: string): boolean {
  const normalised = normaliseAddress(address);
  return withDb((db) => {
    const linked = db
      .prepare(
        `SELECT COUNT(*) AS count FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} WHERE subscription_id = ?`
      )
      .get(subscriptionId) as { count: number };

    if (linked.count >= MAX_ADDRESSES_PER_SUBSCRIPTION) {
      const alreadyLinked = db
        .prepare(
          `SELECT 1 FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} WHERE subscription_id = ? AND address = ?`
        )
        .get(subscriptionId, normalised);
      if (!alreadyLinked) return false;
    }

    db.prepare(
      `INSERT OR IGNORE INTO ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} (subscription_id, address, created_at) VALUES (?, ?, ?)`
    ).run(subscriptionId, normalised, Date.now());
    return true;
  });
}

/**
 * Unlinks an address from the subscription with the given endpoint. When no
 * address is provided the entire subscription (and all of its links) is
 * removed. Returns the number of removed rows.
 */
export function unlinkAddress(endpoint: string, address?: string): number {
  return withDb((db) => {
    const subscription = db
      .prepare(`SELECT id FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE endpoint = ?`)
      .get(endpoint) as { id: number } | undefined;

    if (!subscription) return 0;

    const affectedAddresses: string[] = [];

    if (!address) {
      const rows = db
        .prepare(
          `SELECT address FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} WHERE subscription_id = ?`
        )
        .all(subscription.id) as Array<{ address: string }>;
      affectedAddresses.push(...rows.map((row) => row.address));

      const result = db
        .prepare(`DELETE FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE id = ?`)
        .run(subscription.id);
      pruneUnwatchedNodeStates(db, affectedAddresses);
      return result.changes;
    }

    const normalised = normaliseAddress(address);
    affectedAddresses.push(normalised);

    const result = db
      .prepare(
        `DELETE FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} WHERE subscription_id = ? AND address = ?`
      )
      .run(subscription.id, normalised);

    // Prune subscriptions that no longer watch any address.
    db.prepare(
      `DELETE FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE id = ? AND id NOT IN (SELECT DISTINCT subscription_id FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES})`
    ).run(subscription.id);

    pruneUnwatchedNodeStates(db, affectedAddresses);

    return result.changes;
  });
}

/**
 * Removes the seeded node states of addresses that are no longer watched by any subscription,
 * so that re-subscribing later re-seeds from scratch instead of firing catch-up notifications
 * for transitions that happened while unsubscribed.
 */
function pruneUnwatchedNodeStates(
  db: ReturnType<typeof openNotificationsDatabase>,
  addresses: string[]
) {
  const prune = db.prepare(
    `DELETE FROM ${NOTIFICATIONS_TABLE.NODE_STATE} WHERE address = ? AND address NOT IN (SELECT DISTINCT address FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES})`
  );
  for (const address of addresses) {
    prune.run(address);
  }
}

export function getSubscriptionByEndpoint(endpoint: string): PushSubscriptionRow | undefined {
  return withDb((db) =>
    db
      .prepare(`SELECT * FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE endpoint = ?`)
      .get(endpoint)
  ) as PushSubscriptionRow | undefined;
}

export function deleteSubscriptionById(subscriptionId: SubscriptionId): void {
  withDb((db) => {
    db.prepare(`DELETE FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE id = ?`).run(
      subscriptionId
    );
  });
}

/**
 * Migrates a push subscription to a new endpoint (e.g. after the browser
 * rotates it), keeping all linked addresses. Returns `false` when the old
 * endpoint is unknown or the new endpoint is already taken.
 */
export function migrateSubscriptionEndpoint(input: {
  oldEndpoint: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): boolean {
  return withDb((db) => {
    const existing = db
      .prepare(`SELECT id FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE endpoint = ?`)
      .get(input.oldEndpoint) as { id: number } | undefined;

    if (!existing) return false;

    const taken = db
      .prepare(`SELECT id FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE endpoint = ?`)
      .get(input.endpoint);

    if (taken) return false;

    db.prepare(
      `UPDATE ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} SET endpoint = ?, p256dh = ?, auth = ?, last_seen_at = ? WHERE id = ?`
    ).run(input.endpoint, input.p256dh, input.auth, Date.now(), existing.id);
    return true;
  });
}

export function getAddressesForSubscription(endpoint: string): string[] {
  return withDb((db) => {
    // Client-initiated read: counts as subscription activity for expiry purposes.
    db.prepare(
      `UPDATE ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} SET last_seen_at = ? WHERE endpoint = ?`
    ).run(Date.now(), endpoint);

    const rows = db
      .prepare(
        `SELECT address FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} WHERE subscription_id = (SELECT id FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE endpoint = ?) ORDER BY created_at ASC`
      )
      .all(endpoint) as Array<{ address: string }>;
    return rows.map((row) => row.address);
  });
}

export function getSubscriptionsForAddress(address: string): PushSubscriptionRow[] {
  return withDb((db) =>
    db
      .prepare(
        `SELECT * FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE id IN (SELECT subscription_id FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} WHERE address = ?)`
      )
      .all(normaliseAddress(address))
  ) as PushSubscriptionRow[];
}

/**
 * Deletes subscriptions that have not been seen in a client-initiated request for longer than
 * `maxAgeMs` (browsers rotate push subscriptions over time, so stale rows are dead weight and
 * a privacy liability). Also prunes the node states of addresses that become unwatched.
 * Returns the number of expired subscriptions.
 */
export function expireStaleSubscriptions(maxAgeMs: number): number {
  return withDb((db) => {
    const stale = db
      .prepare(`SELECT id FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE last_seen_at < ?`)
      .all(Date.now() - maxAgeMs) as Array<{ id: number }>;

    if (stale.length === 0) return 0;

    const affectedAddresses = new Set<string>();
    const linksFor = db.prepare(
      `SELECT address FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES} WHERE subscription_id = ?`
    );
    for (const { id } of stale) {
      const links = linksFor.all(id) as Array<{ address: string }>;
      for (const link of links) affectedAddresses.add(link.address);
    }

    const deleteSubscription = db.prepare(
      `DELETE FROM ${NOTIFICATIONS_TABLE.PUSH_SUBSCRIPTIONS} WHERE id = ?`
    );
    for (const { id } of stale) {
      deleteSubscription.run(id);
    }

    pruneUnwatchedNodeStates(db, [...affectedAddresses]);

    return stale.length;
  });
}

export function getWatchedAddresses(): string[] {
  return withDb((db) => {
    const rows = db
      .prepare(`SELECT DISTINCT address FROM ${NOTIFICATIONS_TABLE.SUBSCRIPTION_ADDRESSES}`)
      .all() as Array<{ address: string }>;
    return rows.map((row) => row.address);
  });
}

export function getNodeStates(address: string): Map<string, string> {
  return withDb((db) => {
    const rows = db
      .prepare(
        `SELECT pubkey_ed25519, state FROM ${NOTIFICATIONS_TABLE.NODE_STATE} WHERE address = ?`
      )
      .all(normaliseAddress(address)) as Array<{ pubkey_ed25519: string; state: string }>;
    return new Map(rows.map((row) => [row.pubkey_ed25519, row.state]));
  });
}

export function upsertNodeState(address: string, pubkeyEd25519: string, state: string): void {
  withDb((db) => {
    db.prepare(
      `INSERT INTO ${NOTIFICATIONS_TABLE.NODE_STATE} (address, pubkey_ed25519, state, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (address, pubkey_ed25519) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`
    ).run(normaliseAddress(address), pubkeyEd25519, state, Date.now());
  });
}

export function deleteNodeStatesExcept(address: string, keepPubkeys: string[]): void {
  withDb((db) => {
    if (keepPubkeys.length === 0) {
      db.prepare(`DELETE FROM ${NOTIFICATIONS_TABLE.NODE_STATE} WHERE address = ?`).run(
        normaliseAddress(address)
      );
      return;
    }
    const placeholders = keepPubkeys.map(() => '?').join(', ');
    db.prepare(
      `DELETE FROM ${NOTIFICATIONS_TABLE.NODE_STATE} WHERE address = ? AND pubkey_ed25519 NOT IN (${placeholders})`
    ).run(normaliseAddress(address), ...keepPubkeys);
  });
}
