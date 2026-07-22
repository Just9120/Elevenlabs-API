#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${1:-}"
EXPECTED_BRANCH="${2:-}"
EXPECTED_REPO="${3:-}"
EXPECTED_COMMIT="${4:-}"
MANAGE_SCRIPT="scripts/manage_studio_worker.sh"
ENV_FILE="deploy/studio/.env"
MAX_DRAIN_SECONDS=19200

fail() {
  printf '[studio-worker-drain] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -n "$DEPLOY_DIR" && -n "$EXPECTED_BRANCH" && -n "$EXPECTED_REPO" && -n "$EXPECTED_COMMIT" ]] || fail "required invocation arguments are missing"
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "expected commit must be a 40-character hexadecimal SHA"

expected_dir="$(cd "$DEPLOY_DIR" 2>/dev/null && pwd -P || true)"
[[ -n "$expected_dir" && "$expected_dir" == "$DEPLOY_DIR" ]] || fail "deploy directory identity mismatch"
cd "$expected_dir"
[[ "$(pwd -P)" == "$expected_dir" ]] || fail "current directory identity mismatch"

remote="$(git config --get remote.origin.url 2>/dev/null || true)"
case "$remote" in
  git@github.com:${EXPECTED_REPO}.git|git@github.com:${EXPECTED_REPO}|https://github.com/${EXPECTED_REPO}.git) ;;
  *) fail "repository remote identity mismatch" ;;
esac

[[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)" == "$EXPECTED_BRANCH" ]] || fail "branch identity mismatch"
[[ "$(git rev-parse HEAD 2>/dev/null || true)" == "$EXPECTED_COMMIT" ]] || fail "commit identity mismatch"
[[ -z "$(git status --porcelain --untracked-files=no 2>/dev/null || true)" ]] || fail "tracked working tree is not clean"
git ls-files --error-unmatch -- "$MANAGE_SCRIPT" >/dev/null 2>&1 || fail "worker management script is not tracked"
[[ -f "$MANAGE_SCRIPT" && -x "$MANAGE_SCRIPT" ]] || fail "worker management script is unavailable"

initial_status="$(STUDIO_DEPLOY_DIR="$expected_dir" "$expected_dir/$MANAGE_SCRIPT" status)"
printf '%s\n' "$initial_status"

ttl="${STUDIO_WORKER_LEASE_TTL_SECONDS:-}"
if [[ -z "$ttl" && -f "$ENV_FILE" ]]; then
  ttl="$(sed -n 's/^STUDIO_WORKER_LEASE_TTL_SECONDS=//p' "$ENV_FILE" | tail -n1)"
fi
if [[ ! "$ttl" =~ ^[0-9]+$ ]]; then
  ttl=3600
fi
[[ "${#ttl}" -le 6 ]] || fail "configured worker lease TTL exceeds the supported workflow budget"
buffer="${STUDIO_WORKER_DRAIN_BUFFER_SECONDS:-60}"
[[ "$buffer" =~ ^[0-9]+$ && "${#buffer}" -le 6 ]] || fail "configured worker drain buffer is invalid"
drain_seconds=$((ttl + buffer))
((drain_seconds <= MAX_DRAIN_SECONDS)) || fail "configured worker drain timeout exceeds the supported workflow budget"

STUDIO_DEPLOY_DIR="$expected_dir" "$expected_dir/$MANAGE_SCRIPT" drain

final_status="$(STUDIO_DEPLOY_DIR="$expected_dir" "$expected_dir/$MANAGE_SCRIPT" status)"
printf '%s\n' "$final_status"
if grep -Fxq 'container_state=absent' <<<"$final_status" && grep -Fxq 'drain_state=absent' <<<"$final_status"; then
  :
elif grep -Fxq 'container_state=exited' <<<"$final_status" && grep -Fxq 'exit_code=0' <<<"$final_status" && grep -Fxq 'drain_state=gracefully-drained' <<<"$final_status"; then
  :
else
  fail "worker did not reach a confirmed gracefully drained or absent state"
fi

printf 'STUDIO_WORKER_DRAIN_WORKFLOW_OK\n'
