#!/usr/bin/env bash
# Syncs this repository to remote servers and restarts the service.
# Customize via env vars: REMOTE_USER, REMOTE_PATH, REMOTE_BRANCH, REMOTE_RESTART_CMD, SSH_OPTS.

set -euo pipefail

SERVERS=(
  "81.15.150.153"
  "81.15.150.22"
)

REMOTE_USER=${REMOTE_USER:-"ubuntu"}
REMOTE_PATH=${REMOTE_PATH:-"/home/${REMOTE_USER}/submarino"}
REMOTE_BRANCH=${REMOTE_BRANCH:-"main"}
REMOTE_RESTART_CMD=${REMOTE_RESTART_CMD:-"npm run start"}
SSH_OPTS=${SSH_OPTS:-""}

run_remote_update() {
  local host=$1
  echo "---- Updating ${host} ----"

  ssh ${SSH_OPTS} "${REMOTE_USER}@${host}" <<EOF
set -euo pipefail
cd "${REMOTE_PATH}"
git fetch origin
git reset --hard "origin/${REMOTE_BRANCH}"
npm install --omit=dev
npm run build
${REMOTE_RESTART_CMD}
EOF
}

for server in "\${SERVERS[@]}"; do
  run_remote_update "\${server}"
done
