#!/usr/bin/env bash
# Starts (or restarts) Lotus lite daemons on a set of remote hosts via SSH.
# Customize targets via FILECOIN_SERVERS env (space-separated) or edit the default list.

set -euo pipefail

DEFAULT_SERVERS=("81.15.150.153" "81.15.150.22")

if [[ -n "${FILECOIN_SERVERS:-}" ]]; then
  # shellcheck disable=SC2206
  SERVER_LIST=(${FILECOIN_SERVERS})
else
  SERVER_LIST=("${DEFAULT_SERVERS[@]}")
fi

REMOTE_USER=${REMOTE_USER:-"ubuntu"}
REMOTE_LOTUS_PATH=${REMOTE_LOTUS_PATH:-"/home/${REMOTE_USER}/.lotus-lite"}
LOTUS_BINARY=${LOTUS_BINARY:-"lotus"}
SSH_OPTS=${SSH_OPTS:-""}
RPC_CHECK_RETRIES=${RPC_CHECK_RETRIES:-15}
RPC_CHECK_DELAY=${RPC_CHECK_DELAY:-5}

start_remote_daemon() {
  local host=$1
  echo "---- Ensuring Lotus is running on ${host} ----"

  ssh ${SSH_OPTS} "${REMOTE_USER}@${host}" <<EOF
set -euo pipefail
if ! command -v ${LOTUS_BINARY} >/dev/null 2>&1; then
  echo "[error] lotus binary \"${LOTUS_BINARY}\" not found in PATH on ${host}" >&2
  exit 1
fi

mkdir -p "${REMOTE_LOTUS_PATH}"

if pgrep -f "${LOTUS_BINARY} daemon --lite" >/dev/null 2>&1; then
  echo "Lotus daemon already running on ${host}"
else
  echo "Starting lotus daemon on ${host}"
  nohup env LOTUS_PATH="${REMOTE_LOTUS_PATH}" \
       LOTUS_MINER_PATH="${REMOTE_LOTUS_PATH}/miner" \
       LOTUS_MARKETS_PATH="${REMOTE_LOTUS_PATH}/markets" \
       ${LOTUS_BINARY} daemon --lite > "${REMOTE_LOTUS_PATH}/lotus.log" 2>&1 &
  echo \$! > "${REMOTE_LOTUS_PATH}/lotus.pid"
  echo "Spawned lotus daemon with pid \$(cat "${REMOTE_LOTUS_PATH}/lotus.pid")"
fi

echo "Waiting for JSON-RPC readiness..."
for attempt in \$(seq 1 ${RPC_CHECK_RETRIES}); do
  if env LOTUS_PATH="${REMOTE_LOTUS_PATH}" ${LOTUS_BINARY} sync status >/dev/null 2>&1; then
    env LOTUS_PATH="${REMOTE_LOTUS_PATH}" ${LOTUS_BINARY} chain head >/dev/null 2>&1 && break
  fi
  sleep ${RPC_CHECK_DELAY}
  if [[ \${attempt} -eq ${RPC_CHECK_RETRIES} ]]; then
    echo "[warn] Lotus RPC still warming up after \${attempt} attempts"
  fi
done

env LOTUS_PATH="${REMOTE_LOTUS_PATH}" ${LOTUS_BINARY} sync status | head -n 8 || true
EOF
}

for server in "${SERVER_LIST[@]}"; do
  start_remote_daemon "${server}"
done

echo "All requested hosts processed."
