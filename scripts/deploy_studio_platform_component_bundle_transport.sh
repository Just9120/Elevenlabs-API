#!/usr/bin/env bash
set -euo pipefail
umask 077

PREFIX="[studio-platform-bundle-transport]"
DEPLOY_DIR="/opt/elevenlabs-studio"
LOCAL_BUNDLE=""
REMOTE_BUNDLE=""

fail() {
  printf '%s ERROR: %s\n' "$PREFIX" "$1" >&2
  exit 1
}

cleanup() {
  local status=$?
  trap - EXIT
  [[ -z "$LOCAL_BUNDLE" ]] || rm -f -- "$LOCAL_BUNDLE"
  if [[ "$REMOTE_BUNDLE" =~ ^/tmp/studio-deploy-bundle\.[A-Za-z0-9]+$ ]]; then
    ssh -i ~/.ssh/deploy_key \
      -o BatchMode=yes \
      -o StrictHostKeyChecking=yes \
      -o UserKnownHostsFile=~/.ssh/known_hosts \
      "$DEPLOY_USER@$DEPLOY_HOST" \
      "rm -f -- '$REMOTE_BUNDLE'" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

component="${1:-}"
case "$component" in
  web | api | worker) ;;
  *) fail "usage: $0 <web|api|worker>" ;;
esac

for name in DEPLOY_HOST DEPLOY_USER EXPECTED_COMMIT; do
  [[ -n "${!name:-}" ]] || fail "required environment value is missing: $name"
done
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "expected commit is invalid"
[[ "$(git rev-parse HEAD 2>/dev/null)" == "$EXPECTED_COMMIT" ]] \
  || fail "runner checkout does not match expected commit"

for tool in awk git mktemp rm scp sha256sum ssh; do
  command -v "$tool" >/dev/null || fail "required tool is missing: $tool"
done

LOCAL_BUNDLE="$(mktemp)"
git bundle create "$LOCAL_BUNDLE" HEAD
bundle_head="$(git bundle list-heads "$LOCAL_BUNDLE" | awk '$2 == "HEAD" {print $1}')"
[[ "$bundle_head" == "$EXPECTED_COMMIT" ]] || fail "bundle identity mismatch"
bundle_sha="$(sha256sum "$LOCAL_BUNDLE" | awk '{print $1}')"
[[ "$bundle_sha" =~ ^[0-9a-f]{64}$ ]] || fail "bundle checksum is invalid"

REMOTE_BUNDLE="$(
  ssh -i ~/.ssh/deploy_key \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile=~/.ssh/known_hosts \
    "$DEPLOY_USER@$DEPLOY_HOST" \
    'umask 077; mktemp /tmp/studio-deploy-bundle.XXXXXX'
)"
[[ "$REMOTE_BUNDLE" =~ ^/tmp/studio-deploy-bundle\.[A-Za-z0-9]+$ ]] \
  || fail "remote bundle path is invalid"

scp -q \
  -i ~/.ssh/deploy_key \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=~/.ssh/known_hosts \
  "$LOCAL_BUNDLE" \
  "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_BUNDLE"

ssh -i ~/.ssh/deploy_key \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=~/.ssh/known_hosts \
  "$DEPLOY_USER@$DEPLOY_HOST" \
  "bash -se -- '$DEPLOY_DIR' '$REMOTE_BUNDLE' '$bundle_sha' '$EXPECTED_COMMIT' '$component'" <<'REMOTE'
set -euo pipefail

DEPLOY_DIR="$1"
BUNDLE_FILE="$2"
EXPECTED_BUNDLE_SHA="$3"
EXPECTED_COMMIT="$4"
COMPONENT="$5"
EXPECTED_BRANCH="main"
DEPLOY_SCRIPT="scripts/deploy_studio_platform_component.sh"

[[ "$DEPLOY_DIR" == "/opt/elevenlabs-studio" ]]
[[ "$BUNDLE_FILE" =~ ^/tmp/studio-deploy-bundle\.[A-Za-z0-9]+$ ]]
[[ -f "$BUNDLE_FILE" && ! -L "$BUNDLE_FILE" && -O "$BUNDLE_FILE" ]]
[[ "$(stat -c %a -- "$BUNDLE_FILE")" == "600" ]]
[[ "$EXPECTED_BUNDLE_SHA" =~ ^[0-9a-f]{64}$ ]]
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]]
case "$COMPONENT" in web | api | worker) ;; *) exit 1 ;; esac
[[ "$(sha256sum "$BUNDLE_FILE" | awk '{print $1}')" == "$EXPECTED_BUNDLE_SHA" ]]

cd "$DEPLOY_DIR"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "$EXPECTED_BRANCH" ]]
[[ -z "$(git status --porcelain --untracked-files=no)" ]]
git fetch --no-tags "$BUNDLE_FILE" "HEAD:refs/remotes/origin/$EXPECTED_BRANCH"
[[ "$(git rev-parse "origin/$EXPECTED_BRANCH")" == "$EXPECTED_COMMIT" ]]

temporary_script="$(mktemp)"
trap 'rm -f -- "$temporary_script"' EXIT
git show "origin/$EXPECTED_BRANCH:$DEPLOY_SCRIPT" >"$temporary_script"
[[ -s "$temporary_script" ]]

STUDIO_DEPLOY_DIR="$DEPLOY_DIR" \
STUDIO_DEPLOY_FETCH_BUNDLE="$BUNDLE_FILE" \
  bash "$temporary_script" "$COMPONENT"
REMOTE

printf '%s OK component=%s commit=%s\n' \
  "$PREFIX" "$component" "${EXPECTED_COMMIT:0:12}"
