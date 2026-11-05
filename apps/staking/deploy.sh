#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
LOCAL_STANDALONE="$APP_DIR/.next/standalone"

# Deploy configuration is loaded from .env.deploy (see .env.deploy.template);
# variables already exported in the environment take precedence
DEPLOY_ENV_FILE="$APP_DIR/.env.deploy"
if [ -f "$DEPLOY_ENV_FILE" ]; then
  echo "[deploy] loading config from $DEPLOY_ENV_FILE"
  while IFS='=' read -r key value; do
    case "$key" in ''|'#'*) continue ;; esac
    value="${value#\"}" value="${value%\"}"
    value="${value#\'}" value="${value%\'}"
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$DEPLOY_ENV_FILE"
fi

REMOTE="${DEPLOY_REMOTE:?Set DEPLOY_REMOTE (e.g. root@host) in .env.deploy or the environment}"
REMOTE_PATH="${DEPLOY_PATH:?Set DEPLOY_PATH (e.g. /root/staking) in .env.deploy or the environment}"
RESTART_CMD="${DEPLOY_RESTART_CMD:-}"

BINDING_REL="node_modules/better-sqlite3-multiple-ciphers/build/Release/better_sqlite3.node"

cd "$REPO_ROOT"

# Start from a clean standalone tree; next build does not prune it and
# leftovers from previous builds would be deployed as dead weight
rm -rf "$LOCAL_STANDALONE"

# Clean build with standalone output; --force bypasses the turbo cache so
# env changes can never serve a stale build. Runs via mise to pick up the
# repo's pinned node/pnpm versions.
BUILD_CMD=(pnpm turbo build --filter=@session/staking --force)
if command -v mise >/dev/null 2>&1; then
  STANDALONE=true mise exec -- "${BUILD_CMD[@]}"
else
  STANDALONE=true "${BUILD_CMD[@]}"
fi

# Monorepo standalone output nests the app under the traced workspace root
# (e.g. .next/standalone/session-websites/apps/staking/server.js)
SERVER_JS="$(find "$LOCAL_STANDALONE" -type f -name server.js -path '*/apps/staking/*' -print -quit)"
[ -n "$SERVER_JS" ] || { echo "[deploy] FATAL: server.js not found in standalone output" >&2; exit 1; }
APP_OUT_DIR="$(dirname "$SERVER_JS")"
echo "[deploy] standalone app dir: $APP_OUT_DIR"

# Assemble: static assets, public files, flags db, runtime env
cp -r "$APP_DIR/.next/static" "$APP_OUT_DIR/.next/"
cp -r "$APP_DIR/public" "$APP_OUT_DIR/"
mkdir -p "$APP_OUT_DIR/db"
cp "$APP_DIR/db/flags.sqlite" "$APP_OUT_DIR/db/flags.sqlite"
cp "$APP_DIR/.env.runtime" "$APP_OUT_DIR/.env.production"

# Next's file tracing drops the native sqlite binding (its path is built
# dynamically from cwd), so place it where the runtime resolves it from
if [ ! -f "$APP_OUT_DIR/$BINDING_REL" ]; then
  echo "[deploy] native binding missing in standalone, copying it in"
  mkdir -p "$APP_OUT_DIR/$(dirname "$BINDING_REL")"
  if [ -e "$APP_DIR/$BINDING_REL" ]; then
    cp -L "$APP_DIR/$BINDING_REL" "$APP_OUT_DIR/$BINDING_REL"
  elif [ -e "$REPO_ROOT/$BINDING_REL" ]; then
    cp -L "$REPO_ROOT/$BINDING_REL" "$APP_OUT_DIR/$BINDING_REL"
  else
    echo "[deploy] FATAL: better_sqlite3.node not found in workspace node_modules" >&2
    exit 1
  fi
fi

# Deploy the whole traced tree; the notifications db is runtime state and
# must never be deleted
rsync -avz --delete --exclude '**/db/notifications.sqlite*' "$LOCAL_STANDALONE/" "$REMOTE:$REMOTE_PATH/"

if [ -n "$RESTART_CMD" ]; then
  ssh "$REMOTE" "cd $REMOTE_PATH/*/apps/staking 2>/dev/null || cd $REMOTE_PATH/apps/staking; $RESTART_CMD"
fi

echo "Deployed!"
