#!/usr/bin/env bash
# Summarize Lotus and Submarino peer state across all remote hosts.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/remote-common.sh"

status_host() {
  local host=$1
  run_remote_script "${host}" env REMOTE_LOTUS_PATH="${REMOTE_LOTUS_PATH}" REMOTE_PATH="${REMOTE_PATH}" bash -s <<'EOF'
set -euo pipefail
echo "==== $(hostname) :: $(date -u) ===="
if command -v lotus >/dev/null 2>&1; then
  echo "-- lotus net peers --"
  env LOTUS_PATH="${REMOTE_LOTUS_PATH}" lotus net peers | grep -E 'Peer|Addrs' -A1 || true
else
  echo "-- lotus not installed --"
fi
echo "-- filecoin health --"
curl -s --max-time 5 http://127.0.0.1:4242/filecoin/health || echo "(no /filecoin/health endpoint)"
TRUSTED="${REMOTE_PATH}/.keys/mcp/trustedPeers.json"
if [[ -f "${TRUSTED}" ]]; then
  echo "-- trusted peers --"
  TRUSTED_PATH="${TRUSTED}" python3 - <<'PY'
import json, os
path = os.environ["TRUSTED_PATH"]
try:
    data = json.load(open(path, "r", encoding="utf-8"))
    print(json.dumps(data, indent=2))
except Exception as exc:
    print(f"Failed to read {path}: {exc}")
PY
else
  echo "-- trusted peers -- (none)"
fi
EOF
}

for_each_host status_host

