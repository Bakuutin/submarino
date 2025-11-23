#!/usr/bin/env bash
# High-level orchestrator for remote Submarino + Filecoin clusters.
# Usage:
#   scripts/cluster.sh <command> [args]
#
# Commands:
#   deploy            -> git sync + build + restart (remote-update deploy)
#   status            -> summarize git + lotus status
#   lotus install     -> install lotus binary on all servers
#   lotus start       -> ensure lotus daemons are running
#   lotus status      -> show lotus sync/net info
#   connect           -> connect lotus peers together
#   env               -> copy .env to every host
#   bootstrap         -> env push + lotus install/start + deploy + connect

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/remote-common.sh"

REMOTE_UPDATE="${SCRIPT_DIR}/remote-update.sh"
REMOTE_LOTUS="${SCRIPT_DIR}/remote-filecoin-daemon.sh"
REMOTE_CONNECT="${SCRIPT_DIR}/remote-filecoin-connect.sh"
ENV_FILE=${ENV_FILE:-"${PROJECT_ROOT}/.env"}

usage() {
  cat <<'EOF'
Usage: scripts/cluster.sh <command> [subcommand]

Commands:
  deploy                 Run remote-update deploy (git fetch + build + restart)
  status                 Run remote-update status and lotus status summaries
  lotus install|start|status
  connect [listen|connect|status]
  env [push|show]        Copy or inspect the .env file on each host
  bootstrap              env push + lotus install/start + deploy + connect
EOF
}

push_env_host() {
  local host=$1
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing env file at ${ENV_FILE}" >&2
    exit 1
  fi
  run_remote_script "${host}" env REMOTE_PATH="${REMOTE_PATH}" bash -s <<'EOF'
set -euo pipefail
mkdir -p "${REMOTE_PATH}"
EOF
  log "[${host}] uploading ${ENV_FILE}"
  # shellcheck disable=SC2086
  scp ${SSH_OPTS} "${ENV_FILE}" "${REMOTE_USER}@${host}:${REMOTE_PATH}/.env" >/dev/null
}

show_env_host() {
  local host=$1
  run_remote_script "${host}" env REMOTE_PATH="${REMOTE_PATH}" bash -s <<'EOF'
set -euo pipefail
echo "---- $(hostname) .env ----"
if [[ -f "${REMOTE_PATH}/.env" ]]; then
  sed -n '1,40p' "${REMOTE_PATH}/.env"
else
  echo "(no .env found)"
fi
EOF
}

COMMAND=${1:-}
SUBCOMMAND=${2:-}

case "${COMMAND}" in
  deploy|"")
    "${REMOTE_UPDATE}" deploy
    ;;
  status)
    "${REMOTE_UPDATE}" status
    "${REMOTE_LOTUS}" status
    "${REMOTE_CONNECT}" status
    ;;
  lotus)
    SUBCOMMAND=${SUBCOMMAND:-start}
    "${REMOTE_LOTUS}" "${SUBCOMMAND}"
    ;;
  connect)
    SUBCOMMAND=${SUBCOMMAND:-connect}
    "${REMOTE_CONNECT}" "${SUBCOMMAND}"
    ;;
  env)
    SUBCOMMAND=${SUBCOMMAND:-push}
    case "${SUBCOMMAND}" in
      push)
        for_each_host push_env_host
        ;;
      show)
        for_each_host show_env_host
        ;;
      *)
        usage
        exit 1
        ;;
    esac
    ;;
  bootstrap)
    for_each_host push_env_host
    "${REMOTE_LOTUS}" install
    "${REMOTE_LOTUS}" start
    "${REMOTE_UPDATE}" deploy
    "${REMOTE_CONNECT}" connect
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
