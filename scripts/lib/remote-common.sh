#!/usr/bin/env bash
# Shared helpers for all remote automation scripts.

if [[ -n "${REMOTE_COMMON_LOADED:-}" ]]; then
  return 0
fi

REMOTE_COMMON_LOADED=1

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  echo "[remote $(timestamp)] $*" >&2
}

# Remote topology defaults
DEFAULT_SERVERS=("81.15.150.153" "81.15.150.22")
if [[ -n "${REMOTE_SERVERS:-}" ]]; then
  # shellcheck disable=SC2206
  SERVERS=(${REMOTE_SERVERS})
else
  SERVERS=("${DEFAULT_SERVERS[@]}")
fi

REMOTE_USER=${REMOTE_USER:-"ubuntu"}
REMOTE_PATH=${REMOTE_PATH:-"/home/${REMOTE_USER}/submarino"}
REMOTE_BRANCH=${REMOTE_BRANCH:-"main"}
REMOTE_RESTART_CMD=${REMOTE_RESTART_CMD:-"npm run start"}
REMOTE_LOTUS_PATH=${REMOTE_LOTUS_PATH:-"/home/${REMOTE_USER}/.lotus-lite"}
LOTUS_VERSION=${LOTUS_VERSION:-"v1.34.1"}
LOTUS_TARBALL="lotus_${LOTUS_VERSION}_linux_amd64_v1"
LOTUS_DOWNLOAD_URL="https://github.com/filecoin-project/lotus/releases/download/${LOTUS_VERSION}/${LOTUS_TARBALL}.tar.gz"
SSH_OPTS=${SSH_OPTS:-""}
ENV_FILE=${ENV_FILE:-"${PROJECT_ROOT}/.env"}

REMOTE_LOG_DIR=${REMOTE_LOG_DIR:-"${PROJECT_ROOT}/logs/remote"}
mkdir -p "${REMOTE_LOG_DIR}"

host_log_file() {
  local host=$1
  echo "${REMOTE_LOG_DIR}/${host}.log"
}

run_remote_script() {
  local host=$1
  shift
  local log_file
  log_file=$(host_log_file "${host}")
  log "[${host}] running remote task"
  mkdir -p "$(dirname "${log_file}")"
  ssh ${SSH_OPTS} "${REMOTE_USER}@${host}" "$@" 2>&1 | tee -a "${log_file}"
}

for_each_host() {
  local fn=$1
  shift
  for host in "${SERVERS[@]}"; do
    "${fn}" "${host}" "$@"
  done
}
