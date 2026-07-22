#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${1:-}"
EXPECTED_BRANCH="${2:-}"
EXPECTED_REPO="${3:-}"
EXPECTED_COMMIT="${4:-}"
MANAGE_SCRIPT="scripts/manage_studio_worker.sh"

fail() {
  printf '[studio-worker-status] ERROR: %s\n' "$*" >&2
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

STUDIO_DEPLOY_DIR="$expected_dir" "$expected_dir/$MANAGE_SCRIPT" status
