import 'server-only';

import { REMOTE_FEATURE_FLAG } from '@/lib/feature-flags';
import { getRemoteFeatureFlag } from '@/lib/feature-flags-server';
import { DEFAULT_LOCALE } from '@/lib/locale-util';
import logger from '@/lib/logger';
import { getNodes } from '@/lib/queries/getNodes';
import { STAKE_STATE } from '@/lib/stake-state';
import { createSessionStakingClient } from '@session/staking-api-js/client';
import { type NodesResponse, nodesResponseSchema } from '@session/staking-api-js/schema';
import { getTranslations } from 'next-intl/server';
import { NEXT_PUBLIC_BACKEND_API_URL } from '../env';
import {
  NOTIFICATIONS_POLL_INTERVAL_SECONDS,
  NOTIFICATIONS_SUBSCRIPTION_EXPIRY_DAYS,
  NOTIFICATIONS_WORKER_ENABLED,
  notificationsVapidConfigured,
} from './env';
import { type NodeSnapshot, resolveNodeStateNotifications } from './node-transitions';
import { type NotificationPayload, sendNotificationToAddress } from './push';
import {
  deleteNodeStatesExcept,
  expireStaleSubscriptions,
  getNodeStates,
  getWatchedAddresses,
  upsertNodeState,
} from './store';

type NetworkNode = NodesResponse['nodes'][number];

const NOTIFICATION_URL = '/mystakes';

let workerStarted = false;
let running = false;

export function startNotificationsWorker() {
  if (workerStarted) return;

  if (!NOTIFICATIONS_WORKER_ENABLED) {
    logger.info('Node notifications worker disabled via NOTIFICATIONS_WORKER_ENABLED');
    return;
  }

  if (!notificationsVapidConfigured) {
    logger.info(
      'Node notifications worker not started: VAPID keys are not configured (set NEXT_PUBLIC_VAPID_PUBLIC_KEY and NOTIFICATIONS_VAPID_PRIVATE_KEY)'
    );
    return;
  }

  workerStarted = true;
  logger.info(
    `Node notifications worker started (poll interval: ${NOTIFICATIONS_POLL_INTERVAL_SECONDS}s)`
  );

  setInterval(() => {
    void runWorkerTick();
  }, NOTIFICATIONS_POLL_INTERVAL_SECONDS * 1000);

  // Run the first tick immediately so freshly subscribed addresses are seeded.
  void runWorkerTick();
}

async function runWorkerTick() {
  if (running) return;
  running = true;
  try {
    await checkAllWatchedAddresses();
  } catch (error) {
    logger.error(error, 'Node notifications worker tick failed');
  } finally {
    running = false;
  }
}

async function checkAllWatchedAddresses() {
  const { enabled, error } = await getRemoteFeatureFlag(
    REMOTE_FEATURE_FLAG.DISABLE_NODE_NOTIFICATIONS
  );

  if (enabled) return;
  if (error) logger.warn(error, 'Could not read remote feature flags, continuing anyway');

  const expired = expireStaleSubscriptions(NOTIFICATIONS_SUBSCRIPTION_EXPIRY_DAYS * 86_400_000);
  if (expired > 0) {
    logger.info(`Expired ${expired} stale push subscription(s)`);
  }

  const watchedAddresses = getWatchedAddresses();
  if (watchedAddresses.length === 0) return;

  const client = createSessionStakingClient({ baseUrl: NEXT_PUBLIC_BACKEND_API_URL });
  const response = await getNodes(client);

  const parsed = nodesResponseSchema.parse(response.data);
  const blockHeight = parsed.network.block_height;

  // Index all nodes by the (lowercased) wallet addresses that have a stake in them.
  const stakesByAddress = indexStakesByAddress(parsed.nodes, watchedAddresses);

  for (const address of watchedAddresses) {
    const stakes = stakesByAddress.get(address) ?? [];
    await processAddress(address, stakes, blockHeight);
  }
}

function indexStakesByAddress(nodes: NetworkNode[], watchedAddresses: string[]) {
  const watched = new Set(watchedAddresses);
  const map = new Map<string, NetworkNode[]>();

  for (const node of nodes) {
    const nodeAddresses = new Set<string>([
      node.operator_address,
      ...node.contributors.map((contributor) => contributor.address),
    ]);

    for (const nodeAddress of nodeAddresses) {
      const key = nodeAddress.toLowerCase();
      if (!watched.has(key)) continue;

      const existing = map.get(key);
      if (existing) {
        existing.push(node);
      } else {
        map.set(key, [node]);
      }
    }
  }

  return map;
}

async function processAddress(address: string, nodes: NetworkNode[], blockHeight: number) {
  const previousStates = getNodeStates(address);

  const { notifications, currentStates } = resolveNodeStateNotifications(
    previousStates,
    nodes,
    blockHeight
  );

  for (const { node, state } of notifications) {
    await sendNodeStateNotification(address, node, state);
  }

  for (const [nodeKey, state] of currentStates) {
    upsertNodeState(address, nodeKey, state);
  }

  // Forget nodes that no longer appear for this address so they re-seed if they return.
  deleteNodeStatesExcept(address, [...currentStates.keys()]);
}

async function sendNodeStateNotification(
  address: string,
  node: NodeSnapshot,
  state: string
): Promise<void> {
  const dict = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'notifications.push' });

  const nodeLabel = shortenEd25519Key(node.pubkey_ed25519);

  let payload: NotificationPayload;

  switch (state) {
    case STAKE_STATE.DECOMMISSIONED:
      payload = {
        title: dict('decommissioned.title'),
        body: dict('decommissioned.body', { node: nodeLabel }),
        tag: `decommissioned:${node.pubkey_ed25519}`,
        url: NOTIFICATION_URL,
      };
      break;
    case STAKE_STATE.AWAITING_EXIT:
      payload = {
        title: dict('readyForExit.title'),
        body: dict('readyForExit.body', { node: nodeLabel }),
        tag: `ready-for-exit:${node.pubkey_ed25519}`,
        url: NOTIFICATION_URL,
      };
      break;
    case STAKE_STATE.DEREGISTERED:
      payload = {
        title: dict('deregistered.title'),
        body: dict('deregistered.body', { node: nodeLabel }),
        tag: `ready-for-exit:${node.pubkey_ed25519}`,
        url: NOTIFICATION_URL,
      };
      break;
    default:
      return;
  }

  await sendNotificationToAddress(address, payload);
}

function shortenEd25519Key(key: string) {
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}
