#!/usr/bin/env bash
# Syncs this repository to remote servers and restarts the service.
# Usage:
#   scripts/remote-update.sh [deploy|status]
# Environment overrides: REMOTE_USER, REMOTE_PATH, REMOTE_BRANCH, REMOTE_RESTART_CMD, SSH_OPTS, REMOTE_SERVERS

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/remote-common.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [deploy|status]

deploy (default)  Fetches git, installs deps, rebuilds, and restarts MCP on every host.
status            Shows git HEAD, current branch, and running Node processes per host.
EOF
}

ACTION=${1:-deploy}

deploy_host() {
  local host=$1
  run_remote_script "${host}" env REMOTE_PATH="${REMOTE_PATH}" REMOTE_BRANCH="${REMOTE_BRANCH}" REMOTE_RESTART_CMD="${REMOTE_RESTART_CMD}" bash -s <<'EOF'
set -euo pipefail
cd "${REMOTE_PATH}"
git fetch origin
git reset --hard "origin/${REMOTE_BRANCH}"
npm install --omit=dev
npm run build
eval "${REMOTE_RESTART_CMD}"
EOF
}

status_host() {
  local host=$1
  run_remote_script "${host}" env REMOTE_PATH="${REMOTE_PATH}" bash -s <<'EOF'
set -euo pipefail
cd "${REMOTE_PATH}"
echo "[status] $(hostname) :: $(date -u)"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "HEAD:   $(git rev-parse HEAD)"
git status -sb
echo "Node processes:"
ps -eo pid,cmd | grep -E "node .*index\.js" | grep -v grep || echo "(no node index.js processes)"
EOF
}

case "${ACTION}" in
  deploy)
    for_each_host deploy_host
    ;;
  status)
    for_each_host status_host
    ;;
  *)
    usage
    exit 1
    ;;
esac
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
