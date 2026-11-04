# Session Staking

Session Staking is a [Next.js](https://nextjs.org/) app for managing and staking
to [Session Nodes](https://github.com/oxen-io/oxen-core).

## Getting Started

You can follow the generic instructions in the root [README.md](../../README.md#getting-started) to get started.

## Development

Running the app requires several environment variables to be set. See the [.env.local.template](.env.local.template)
file for a list
of required variables.

We recommend running the [Session Token Staking Backend](https://github.com/oxen-io/sent-staking-backend/) and
a [Session Node](https://github.com/oxen-io/oxen-core) yourself to ensure any changes you make will work
with the latest changes.

### Session Node

You'll need a [Session Node](https://github.com/oxen-io/oxen-core) to make RPC calls to, this node
does not need to be staked to and does not need to join the network as a participating node. You'll need to run the
following to start the node:

```shell
oxend --stagenet --lmq-public tcp://127.0.0.1:<PORT> --l2-provider https://sepolia-rollup.arbitrum.io/rpc
```

You can then set the `NEXT_PUBLIC_SENT_EXPLORER_API_URL` environment variable in your `.env.local` file to point to
the Session Node's RPC endpoint (`tcp://127.0.0.1:<PORT>` in the example above).

**Note:** You can use any available port for the node RPC endpoint, just make sure it's consistent in all places.

### Session Token Staking Backend

Set up the [Session Token Staking Backend](https://github.com/oxen-io/sent-staking-backend/) by following the
instructions in the [README.md](https://github.com/oxen-io/sent-staking-backend/blob/main/README.md).

Make sure the `config.py` file in the backend directory has the following values:

```python
stagenet_rpc = 'tcp://127.0.0.1:<PORT>'
```

You can then run the backend with the following command:

```shell
uwsgi --http 127.0.0.1:5000 --master -p 4 -w sent --callable app --fs-reload sent.py 
```

You can then set the `NEXT_PUBLIC_SENT_STAKING_BACKEND_URL` environment variable in your `.env.local` file to point to
the Session Token Staking Backend's RPC endpoint (`http://127.0.0.1:5000` in the example above).

## Node Notifications (Web Push)

The app can send browser push notifications when a staked node is decommissioned or becomes ready
for exit. Users subscribe per wallet address (a device can watch multiple addresses) from the
wallet sheet. Notifications are also gated by the `remote_disableNodeNotifications` remote feature
flag.

### Local setup

Generate a VAPID keypair and add it to your `.env.local`:

```shell
pnpm --filter @session/staking exec web-push generate-vapid-keys
```

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
NOTIFICATIONS_VAPID_PRIVATE_KEY=<private key>
```

Without these vars the feature is hidden client-side and the background worker does not start.

### How it works

- `public/sw.js` is a minimal service worker handling push events, notification clicks, and push
  subscription rotation. It also makes the app installable as a PWA (`app/manifest.ts`).
- `instrumentation.ts` starts a background worker on server boot (Node runtime only). Each tick it
  fetches **all** nodes from the staking backend (`GET /nodes`), matches them against watched
  addresses (operator + contributors), derives each node's state with the same state machine the UI
  uses (`lib/stake-state.ts`), and pushes a notification on transitions into `Decommissioned` or
  `Ready To Exit`. The first sighting of a node seeds its state silently, so only transitions
  observed while subscribed notify.
- Subscriptions and last-seen node states are stored in a sqlite database, separate from the
  feature-flags and faucet databases. The location is configurable with `NOTIFICATIONS_DB_PATH`
  (absolute or app-relative; defaults to `db/notifications.sqlite`).
- API routes under `app/api/notifications/` manage subscriptions (subscribe, unsubscribe,
  resubscribe on endpoint rotation, list watched addresses for a device).

### Operational notes

- The worker polls every `NOTIFICATIONS_POLL_INTERVAL_SECONDS` (default: 120) and can be disabled
  per instance with `NOTIFICATIONS_WORKER_ENABLED=false`.
- The app is assumed to run as a **single instance** (same assumption as the existing sqlite
  databases). Running multiple instances would send duplicate notifications and race on the state
  database; disable the worker on all but one instance if scaling out. If you do, note that
  subscriptions live in the notifications database: an instance with its own `NOTIFICATIONS_DB_PATH`
  file accepts subscribe writes that the worker instance cannot see, so those devices never get
  notified. Either point every instance at the same `NOTIFICATIONS_DB_PATH` on shared storage, or
  route all `/api/notifications/*` requests to the instance running the worker.
- The notifications database stores push subscription keys in plaintext (like the feature-flags
  database). If this is a concern, restrict filesystem access to the database file.
- The subscribe endpoints are unauthenticated (chain data is public); row caps limit abuse
  (50 addresses per device, 50k devices). Rate limiting is left to the reverse proxy.

### Privacy

What the notification system stores and who can see what:

- **Stored in the notifications database**: the browser push subscription (endpoint + delivery
  keys) and which wallet addresses it watches, plus the last-seen state of the watched nodes.
  This is the only data the feature collects — no IPs, cookies, or analytics are involved.
- **Retention**: unsubscribing (or turning the preference off) deletes the device's data
  immediately, including node states. Subscriptions that have not been seen in a
  client-initiated request for `NOTIFICATIONS_SUBSCRIPTION_EXPIRY_DAYS` days (default: 90) are
  expired and deleted automatically by the worker.
- **Push services** (operated by the browser vendor: Google for Chrome-derived browsers, Mozilla
  for Firefox, Apple for Safari) deliver the notifications. They can see when a message is sent
  and its rough size, but never its content: payloads are end-to-end encrypted to per-device keys
  generated by the browser (RFC 8291). Timing and message length cannot be hidden from a push
  service; this is inherent to the Web Push standard.
- **Notification content** shows a truncated node key. Shoulder-surfers can see that the user
  watches Session nodes, but not which wallet.
- The database file is stored unencrypted at rest (see operational notes above) — the
  endpoint-to-address linkage it contains should be treated as sensitive.
