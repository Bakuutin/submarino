#!/usr/bin/env bash
# Connects Lotus daemons running on remote hosts so they directly peer with each other.
# Usage:
#   scripts/remote-filecoin-connect.sh [connect|listen|status]

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/remote-common.sh"

declare -A LISTEN_ADDRS

collect_addresses() {
  LISTEN_ADDRS=()
  for host in "${SERVERS[@]}"; do
    local addr
    addr=$(run_remote_script "${host}" env REMOTE_LOTUS_PATH="${REMOTE_LOTUS_PATH}" bash -s <<'EOF' | grep '^/ip' | head -n 1 || true
set -euo pipefail
env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus net listen 2>/dev/null || true
EOF
)
    if [[ -z "${addr}" ]]; then
      log "[${host}] unable to read lotus net listen output"
      continue
    fi
    LISTEN_ADDRS["${host}"]=${addr}
    log "[${host}] listen ${addr}"
  done
}

connect_pair() {
  local source=$1
  local target=$2
  local target_addr=${LISTEN_ADDRS[$target]:-}
  if [[ -z "${target_addr}" ]]; then
    log "[${source}] missing target addr for ${target}"
    return
  fi
  run_remote_script "${source}" env REMOTE_LOTUS_PATH="${REMOTE_LOTUS_PATH}" TARGET_ADDR="${target_addr}" bash -s <<'EOF'
set -euo pipefail
if env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus net connect "${TARGET_ADDR}" >/dev/null 2>&1; then
  echo "Connected ${TARGET_ADDR}"
else
  echo "Already connected or failed (${TARGET_ADDR})"
fi
EOF
}

status_host() {
  local host=$1
  run_remote_script "${host}" env REMOTE_LOTUS_PATH="${REMOTE_LOTUS_PATH}" bash -s <<'EOF'
set -euo pipefail
echo "---- $(hostname) peers ----"
env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus net peers | grep -E 'Peer|Addrs' -A1 || true
EOF
}

ACTION=${1:-connect}

case "${ACTION}" in
  listen)
    collect_addresses
    ;;
  connect)
    collect_addresses
    for src in "${SERVERS[@]}"; do
      for dst in "${SERVERS[@]}"; do
        [[ "${src}" == "${dst}" ]] && continue
        connect_pair "${src}" "${dst}"
      done
    done
    ;;
  status)
    for_each_host status_host
    ;;
  *)
    echo "Usage: $(basename "$0") [connect|listen|status]"
    exit 1
    ;;
esac
#!/usr/bin/env bash
# Connects Lotus daemons running on remote hosts so they directly peer with each other.

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

declare -A LISTEN_ADDRS

echo "Collecting lotus net listen addresses..."
for host in "${SERVER_LIST[@]}"; do
  addr=$(ssh ${SSH_OPTS} "${REMOTE_USER}@${host}" "set -euo pipefail; env LOTUS_PATH='${REMOTE_LOTUS_PATH}' ${LOTUS_BINARY} net listen | grep '^/ip' | head -n 1" || true)
  if [[ -z "${addr}" ]]; then
    echo "[warn] Unable to fetch listen address from ${host}. Is lotus running?" >&2
    continue
  fi
  LISTEN_ADDRS["$host"]=$addr
  echo "${host} -> ${addr}"
done

connect_pair() {
  local source=$1
  local target=$2
  local target_addr=${LISTEN_ADDRS[$target]:-}

  if [[ -z "${target_addr}" ]]; then
    echo "[warn] Skipping connect from ${source} to ${target}; missing listen address."
    return
  }

  echo "Connecting ${source} -> ${target}"
  ssh ${SSH_OPTS} "${REMOTE_USER}@${source}" "set -euo pipefail; env LOTUS_PATH='${REMOTE_LOTUS_PATH}' ${LOTUS_BINARY} net connect '${target_addr}' >/dev/null && echo 'Connected ${target_addr}' || echo 'Already connected or failed (${target_addr})'"
}

for src in "${SERVER_LIST[@]}"; do
  for dst in "${SERVER_LIST[@]}"; do
    [[ "${src}" == "${dst}" ]] && continue
    connect_pair "${src}" "${dst}"
  done
done

echo
echo "Current peer summaries:"
for host in "${SERVER_LIST[@]}"; do
  echo "---- ${host} ----"
  ssh ${SSH_OPTS} "${REMOTE_USER}@${host}" "set -euo pipefail; env LOTUS_PATH='${REMOTE_LOTUS_PATH}' ${LOTUS_BINARY} net peers | grep -E 'Peer|Addrs' -A1 || true"
done
