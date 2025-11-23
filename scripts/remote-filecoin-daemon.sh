#!/usr/bin/env bash
# Installs and manages Lotus lite daemons on remote hosts.
# Usage:
#   scripts/remote-filecoin-daemon.sh [install|start|status]

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/remote-common.sh"

RPC_CHECK_RETRIES=${RPC_CHECK_RETRIES:-15}
RPC_CHECK_DELAY=${RPC_CHECK_DELAY:-5}

usage() {
  cat <<EOF
Usage: $(basename "$0") [install|start|status]

install  Downloads the official Lotus release tarball and installs /usr/local/bin/lotus.
start    Ensures 'lotus daemon --lite' is running (default).
status   Prints Lotus version, sync status, and listen addresses on each host.
EOF
}

install_host() {
  local host=$1
  run_remote_script "${host}" env LOTUS_VERSION="${LOTUS_VERSION}" LOTUS_TARBALL="${LOTUS_TARBALL}" LOTUS_DOWNLOAD_URL="${LOTUS_DOWNLOAD_URL}" bash -s <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq --no-install-recommends hwloc jq curl tar ca-certificates >/dev/null
TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT
curl -sSL "${LOTUS_DOWNLOAD_URL}" -o "${TMP_DIR}/lotus.tgz"
tar -xzf "${TMP_DIR}/lotus.tgz" -C "${TMP_DIR}"
sudo install -m 0755 "${TMP_DIR}/${LOTUS_TARBALL}/lotus" /usr/local/bin/lotus
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 1234/tcp >/dev/null 2>&1 || true
  sudo ufw allow 4242/tcp >/dev/null 2>&1 || true
fi
lotus version
EOF
}

start_host() {
  local host=$1
  run_remote_script "${host}" env REMOTE_LOTUS_PATH="${REMOTE_LOTUS_PATH}" RPC_CHECK_RETRIES="${RPC_CHECK_RETRIES}" RPC_CHECK_DELAY="${RPC_CHECK_DELAY}" bash -s <<'EOF'
set -euo pipefail
if ! command -v lotus >/dev/null 2>&1; then
  echo "[error] lotus binary not found in PATH" >&2
  exit 1
fi

mkdir -p "${REMOTE_LOTUS_PATH}"
LOG_PATH="${REMOTE_LOTUS_PATH}/lotus.log"
PID_FILE="${REMOTE_LOTUS_PATH}/lotus.pid"

if pgrep -f "lotus daemon --lite" >/dev/null 2>&1; then
  echo "Lotus daemon already running"
else
  echo "Starting lotus daemon (lite)"
  nohup env LOTUS_PATH="${REMOTE_LOTUS_PATH}" \
       LOTUS_MINER_PATH="${REMOTE_LOTUS_PATH}/miner" \
       LOTUS_MARKETS_PATH="${REMOTE_LOTUS_PATH}/markets" \
       lotus daemon --lite > "${LOG_PATH}" 2>&1 &
  echo $! > "${PID_FILE}"
fi

echo "Waiting for JSON-RPC readiness..."
for attempt in $(seq 1 "${RPC_CHECK_RETRIES}"); do
  if env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus sync status >/dev/null 2>&1; then
    env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus chain head >/dev/null 2>&1 && break
  fi
  sleep "${RPC_CHECK_DELAY}"
  if [[ "${attempt}" -eq "${RPC_CHECK_RETRIES}" ]]; then
    echo "[warn] Lotus RPC still warming up after ${attempt} attempts"
  fi
done

env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus sync status | head -n 8 || true
EOF
}

status_host() {
  local host=$1
  run_remote_script "${host}" env REMOTE_LOTUS_PATH="${REMOTE_LOTUS_PATH}" bash -s <<'EOF'
set -euo pipefail
if ! command -v lotus >/dev/null 2>&1; then
  echo "[status] lotus not installed"
  exit 0
fi
echo "[status] $(hostname) :: $(date -u)"
lotus version || true
echo "--- net listen ---"
env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus net listen || true
echo "--- sync status ---"
env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus sync status | head -n 12 || true
EOF
}

ACTION=${1:-start}

case "${ACTION}" in
  install)
    for_each_host install_host
    ;;
  start)
    for_each_host start_host
    ;;
  status)
    for_each_host status_host
    ;;
  *)
    usage
    exit 1
    ;;
esac

log "All requested hosts processed."
