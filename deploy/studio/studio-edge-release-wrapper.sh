#!/usr/bin/env bash
set -euo pipefail
umask 077

PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

PREFIX="[studio-edge-release-wrapper]"
DEPLOY_DIR="/opt/elevenlabs-studio"
REPO_USER="studio-deploy"
EXPECTED_BRANCH="main"
EXPECTED_REPOSITORY="Just9120/Elevenlabs-API"
RELEASE_SCRIPT="scripts/release_studio_edge.sh"
LOCK_FILE="/run/lock/studio-edge-release.lock"
INSTALLED_PATH="/usr/local/sbin/studio-edge-release-wrapper"
temporary_script=""

cleanup() {
  [[ -z "$temporary_script" ]] || rm -f -- "$temporary_script"
}
trap cleanup EXIT

fail() {
  printf '%s BLOCKED reason=%s\n' "$PREFIX" "$1" >&2
  exit 2
}

repo_git() {
  runuser -u "$REPO_USER" -- \
    git -c core.hooksPath=/dev/null -C "$DEPLOY_DIR" "$@"
}

[[ "$(id -u)" -eq 0 ]] || fail "not_root"
[[ -z "${SSH_TTY:-}" ]] || fail "pty_not_allowed"
[[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^release\ ([0-9a-f]{40})$ ]] \
  || fail "command_not_allowed"
requested_commit="${BASH_REMATCH[1]}"

for tool in bash chmod env flock git id mktemp readlink rm runuser stat; do
  command -v "$tool" >/dev/null || fail "missing_$tool"
done
[[ ! -L "$0" && "$(readlink -f -- "$0")" == "$INSTALLED_PATH" ]] \
  || fail "wrapper_path_invalid"
[[ "$(stat -c %u -- "$INSTALLED_PATH")" == "0" ]] \
  || fail "wrapper_not_root_owned"
case "$(stat -c %a -- "$INSTALLED_PATH")" in
  500 | 700 | 750 | 755) ;;
  *) fail "wrapper_permissions" ;;
esac
id "$REPO_USER" >/dev/null 2>&1 || fail "repository_user_missing"
[[ -d "$DEPLOY_DIR/.git" ]] || fail "repository_missing"
[[ "$(stat -c %u -- "$DEPLOY_DIR")" == "$(id -u "$REPO_USER")" ]] \
  || fail "repository_owner_mismatch"

exec 9>"$LOCK_FILE"
flock -n 9 || fail "release_already_running"

branch="$(repo_git rev-parse --abbrev-ref HEAD 2>/dev/null)" \
  || fail "branch_probe_failed"
[[ "$branch" == "$EXPECTED_BRANCH" ]] || fail "unexpected_branch"
tracked_state="$(repo_git status --porcelain --untracked-files=no 2>/dev/null)" \
  || fail "tracked_tree_probe_failed"
[[ -z "$tracked_state" ]] || fail "tracked_tree_dirty"

remote_url="$(repo_git config --get remote.origin.url 2>/dev/null)" \
  || fail "remote_probe_failed"
case "$remote_url" in
  "git@github.com:${EXPECTED_REPOSITORY}.git" | \
  "git@github.com:${EXPECTED_REPOSITORY}" | \
  "https://github.com/${EXPECTED_REPOSITORY}.git")
    ;;
  *)
    fail "unexpected_remote"
    ;;
esac

repo_git fetch --prune origin "$EXPECTED_BRANCH" </dev/null \
  || fail "fetch_failed"
remote_commit="$(repo_git rev-parse "origin/$EXPECTED_BRANCH" 2>/dev/null)" \
  || fail "remote_commit_probe_failed"
[[ "$remote_commit" == "$requested_commit" ]] \
  || fail "requested_commit_is_not_remote_main"

repo_git merge --ff-only "origin/$EXPECTED_BRANCH" </dev/null \
  || fail "fast_forward_failed"
[[ "$(repo_git rev-parse HEAD 2>/dev/null)" == "$requested_commit" ]] \
  || fail "checkout_commit_mismatch"
tracked_state="$(repo_git status --porcelain --untracked-files=no 2>/dev/null)" \
  || fail "post_fetch_tracked_tree_probe_failed"
[[ -z "$tracked_state" ]] || fail "tracked_tree_changed"

temporary_script="$(mktemp /run/studio-edge-release.XXXXXX)"
repo_git show "${requested_commit}:${RELEASE_SCRIPT}" >"$temporary_script" \
  || fail "release_script_materialization_failed"
[[ -s "$temporary_script" ]] || fail "release_script_empty"
chmod 0500 "$temporary_script"

env -i \
  HOME=/root \
  LANG=C.UTF-8 \
  PATH="$PATH" \
  STUDIO_DEPLOY_DIR="$DEPLOY_DIR" \
  STUDIO_EXPECTED_COMMIT="$requested_commit" \
  STUDIO_REPOSITORY_USER="$REPO_USER" \
  STUDIO_EDGE_RELEASE_LOCK_HELD=yes \
  bash "$temporary_script" </dev/null

printf '%s OK commit=%s\n' "$PREFIX" "${requested_commit:0:12}"
