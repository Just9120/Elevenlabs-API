#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PREFIX="[studio-edge-release]"
FIXED_PATH="${STUDIO_EDGE_FIXED_PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
SOURCE_HEADERS="deploy/studio/studio-security-headers.conf"
ACTIVE_SITE="${STUDIO_EDGE_ACTIVE_SITE:-/etc/nginx/sites-enabled/studio.librechat.online}"
ACTIVE_HEADERS="${STUDIO_EDGE_ACTIVE_HEADERS:-/etc/nginx/snippets/studio-security-headers.conf}"
BACKUP_ROOT="${STUDIO_EDGE_BACKUP_ROOT:-/var/backups/elevenlabs-studio/nginx}"
PUBLIC_ORIGIN="${STUDIO_EDGE_PUBLIC_ORIGIN:-https://studio.librechat.online}"
PYTHON_BIN="${STUDIO_EDGE_PYTHON_BIN:-python3}"
phase="preflight"
mutation_started="no"
backup_file="none"
release_workspace=""

cleanup() {
  [[ -z "$release_workspace" ]] || rm -rf -- "$release_workspace"
}
trap cleanup EXIT

blocked() {
  local reason="$1"
  local rollback="not_needed"

  trap - ERR
  set +e
  if [[ "$mutation_started" == "yes" && "$backup_file" != "none" ]]; then
    rollback="partial"
    if cp -a -- "$backup_file" "$ACTIVE_HEADERS" &&
      nginx -t >/dev/null 2>&1 &&
      systemctl reload nginx; then
      rollback="completed"
    fi
  fi

  printf '%s BLOCKED phase=%s reason=%s rollback=%s backup=%s\n' \
    "$PREFIX" "$phase" "$reason" "$rollback" "$backup_file" >&2
  exit 2
}

unexpected_failure() {
  local rc=$?
  trap - ERR
  blocked "unexpected_command_failure_rc_${rc}"
}
trap unexpected_failure ERR

repo_git() {
  runuser -u "$STUDIO_REPOSITORY_USER" -- \
    git -c core.hooksPath=/dev/null -C "$STUDIO_DEPLOY_DIR" "$@"
}

require_root_file() {
  local path="$1"
  local label="$2"
  [[ -f "$path" && ! -L "$path" ]] || blocked "${label}_missing"
  [[ "$(stat -c %u -- "$path")" == "0" ]] || blocked "${label}_not_root_owned"
}

resolve_active_site() {
  # Nginx commonly enables a root-owned site through a symlink. Only the
  # canonical enabled name may resolve to a direct file in sites-available.
  # Neither the link nor the site is modified by this release.
  local available_directory="${1:-/etc/nginx/sites-available}"
  local target directory
  if [[ ! -L "$ACTIVE_SITE" ]]; then
    require_root_file "$ACTIVE_SITE" "active_site"
    return
  fi
  [[ "$(stat -c %u -- "$ACTIVE_SITE")" == "0" ]] \
    || blocked "active_site_link_not_root_owned"
  target="$(readlink -f -- "$ACTIVE_SITE")" \
    || blocked "active_site_link_broken"
  [[ -d "$available_directory" && ! -L "$available_directory" ]] \
    || blocked "active_site_available_directory_untrusted"
  available_directory="$(readlink -f -- "$available_directory")" \
    || blocked "active_site_available_directory_missing"
  [[ "$(dirname -- "$target")" == "$available_directory" ]] \
    || blocked "active_site_link_outside_available"
  for directory in "$(dirname -- "$ACTIVE_SITE")" "$available_directory" "$(dirname -- "$available_directory")"; do
    [[ -d "$directory" && ! -L "$directory" && "$(stat -c %u -- "$directory")" == "0" ]] \
      || blocked "active_site_directory_untrusted"
    case "$(stat -c %a -- "$directory")" in
      700 | 750 | 755) ;;
      *) blocked "active_site_directory_writable" ;;
    esac
  done
  require_root_file "$target" "active_site_target"
  ACTIVE_SITE="$target"
  printf '%s site_layout=trusted_root_symlink\n' "$PREFIX"
}

validate_headers_file() {
  "$PYTHON_BIN" - "$1" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
required = (
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-Frame-Options",
)
pattern = re.compile(r'^add_header\s+([A-Za-z-]+)\s+"([^"\r\n]+)"\s+always;$')
seen = {}
access_log_disabled = False

for raw_line in text.splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#"):
        continue
    if line == "access_log off;":
        if access_log_disabled:
            raise SystemExit(1)
        access_log_disabled = True
        continue
    match = pattern.fullmatch(line)
    if match is None:
        raise SystemExit(1)
    name, value = match.groups()
    if name not in required or name in seen or not value.strip():
        raise SystemExit(1)
    seen[name] = value

if tuple(seen) != required or not access_log_disabled:
    raise SystemExit(1)
PY
}

verify_response_headers() {
  "$PYTHON_BIN" - "$1" "$2" <<'PY'
from email.parser import HeaderParser
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
raw_headers = Path(sys.argv[2]).read_text(encoding="iso-8859-1")
expected = {}
pattern = re.compile(r'^add_header\s+([A-Za-z-]+)\s+"([^"\r\n]+)"\s+always;$')

for raw_line in source.splitlines():
    match = pattern.fullmatch(raw_line.strip())
    if match:
        expected[match.group(1).lower()] = match.group(2)

blocks = [block for block in re.split(r"\r?\n\r?\n", raw_headers) if block.strip()]
if not blocks:
    raise SystemExit(1)
response_lines = blocks[-1].splitlines()
if not re.fullmatch(r"HTTP/(?:1\.[01]|2|3)\s+200(?:\s+[^\r\n]*)?", response_lines[0]):
    raise SystemExit(1)
# curl --dump-header includes an HTTP status line. HeaderParser accepts only
# header fields; feeding it that line silently turns every field into a body.
headers = HeaderParser().parsestr("\n".join(response_lines[1:]) + "\n\n")

for name, value in expected.items():
    observed = headers.get_all(name, [])
    if observed != [value]:
        raise SystemExit(1)
PY
}

probe_headers() {
  local label="$1"
  local url="$2"
  shift 2
  local attempt headers status

  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    headers="$release_workspace/${label}-${attempt}.headers"
    if ! status="$(
      curl \
        --silent \
        --show-error \
        --http1.1 \
        --header 'Connection: close' \
        --header 'Cache-Control: no-cache' \
        --output /dev/null \
        --dump-header "$headers" \
        --write-out '%{http_code}' \
        --max-time 20 \
        "$@" \
        "$url" \
        2>/dev/null
    )"; then
      status="000"
    fi

    if [[ "$status" == "200" ]] &&
      verify_response_headers "$release_workspace/candidate.conf" "$headers"; then
      printf '%s probe=%s attempt=%s status=200 headers=valid\n' \
        "$PREFIX" "$label" "$attempt"
      return 0
    fi

    printf '%s probe=%s attempt=%s status=%s headers=pending\n' \
      "$PREFIX" "$label" "$attempt" "$status"
    sleep 2
  done

  return 1
}

[[ "$(id -u)" -eq 0 ]] || blocked "not_root"
[[ "${STUDIO_EDGE_RELEASE_LOCK_HELD:-}" == "yes" ]] \
  || blocked "release_lock_not_held"
[[ -n "${STUDIO_DEPLOY_DIR:-}" ]] || blocked "deploy_directory_missing"
[[ "${STUDIO_EXPECTED_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]] \
  || blocked "expected_commit_invalid"
[[ "${STUDIO_REPOSITORY_USER:-}" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] \
  || blocked "repository_user_invalid"

PATH="$FIXED_PATH"
export PATH
for tool in cmp cp curl date dirname git grep id install mkdir mktemp nginx readlink rm runuser sleep stat systemctl "$PYTHON_BIN"; do
  command -v "$tool" >/dev/null || blocked "required_tool_missing"
done
id "$STUDIO_REPOSITORY_USER" >/dev/null 2>&1 \
  || blocked "repository_user_missing"
[[ -d "$STUDIO_DEPLOY_DIR/.git" ]] || blocked "deploy_repository_missing"
cd "$STUDIO_DEPLOY_DIR"
[[ "$(pwd -P)" == "$STUDIO_DEPLOY_DIR" ]] || blocked "deploy_directory_mismatch"
[[ "$(repo_git rev-parse --abbrev-ref HEAD 2>/dev/null)" == "main" ]] \
  || blocked "unexpected_branch"
[[ "$(repo_git rev-parse HEAD 2>/dev/null)" == "$STUDIO_EXPECTED_COMMIT" ]] \
  || blocked "checkout_commit_mismatch"
tracked_state="$(repo_git status --porcelain --untracked-files=no 2>/dev/null)" \
  || blocked "tracked_tree_probe_failed"
[[ -z "$tracked_state" ]] || blocked "tracked_tree_dirty"

[[ -f "$SOURCE_HEADERS" && ! -L "$SOURCE_HEADERS" ]] \
  || blocked "source_headers_missing"
resolve_active_site
require_root_file "$ACTIVE_HEADERS" "active_headers"
case "$(stat -c %a -- "$ACTIVE_HEADERS")" in
  600 | 640 | 644) ;;
  *) blocked "active_headers_permissions" ;;
esac
[[ "$(grep -Ec '^[[:space:]]*include[[:space:]]+/etc/nginx/snippets/studio-security-headers\.conf;$' "$ACTIVE_SITE")" == "1" ]] \
  || blocked "active_site_include_mismatch"

[[ "$PUBLIC_ORIGIN" =~ ^https://([A-Za-z0-9.-]+)$ ]] \
  || blocked "public_origin_invalid"
public_host="${BASH_REMATCH[1]}"

release_workspace="$(mktemp -d /tmp/studio-edge-release.XXXXXX)"
cp --no-dereference -- "$SOURCE_HEADERS" "$release_workspace/candidate.conf" \
  || blocked "candidate_copy_failed"
validate_headers_file "$release_workspace/candidate.conf" \
  || blocked "candidate_headers_invalid"

phase="apply"
action="unchanged"
if ! cmp -s -- "$release_workspace/candidate.conf" "$ACTIVE_HEADERS"; then
  mkdir -p -- "$BACKUP_ROOT"
  backup_file="$BACKUP_ROOT/studio-security-headers.conf.pre-edge-${STUDIO_EXPECTED_COMMIT:0:12}-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -a -- "$ACTIVE_HEADERS" "$backup_file" || blocked "backup_failed"
  active_mode="$(stat -c %a -- "$ACTIVE_HEADERS")"
  mutation_started="yes"
  install -o 0 -g 0 -m "$active_mode" \
    "$release_workspace/candidate.conf" "$ACTIVE_HEADERS" \
    || blocked "candidate_install_failed"
  action="updated"
fi

nginx -t >/dev/null 2>&1 || blocked "nginx_config_invalid"
if [[ "$action" == "updated" ]]; then
  systemctl reload nginx || blocked "nginx_reload_failed"
  sleep 3
fi

phase="postcheck"
nginx -T >"$release_workspace/nginx.dump" 2>&1 \
  || blocked "nginx_dump_failed"
while IFS= read -r directive; do
  [[ -z "$directive" || "$directive" == \#* ]] && continue
  grep -Fq -- "$directive" "$release_workspace/nginx.dump" \
    || blocked "active_directive_missing"
done <"$release_workspace/candidate.conf"

nonce="$(date +%s)"
probe_headers \
  local_tls \
  "${PUBLIC_ORIGIN}/?edge_release=${nonce}" \
  --resolve "${public_host}:443:127.0.0.1" \
  || blocked "local_tls_headers_mismatch"
probe_headers \
  public_tls \
  "${PUBLIC_ORIGIN}/?edge_release=${nonce}" \
  || blocked "public_tls_headers_mismatch"

curl -fsS -o /dev/null --max-time 8 \
  http://127.0.0.1:8182/api/healthz </dev/null \
  || blocked "localhost_api_health_failed"
curl -fsS -o /dev/null --max-time 8 \
  "${PUBLIC_ORIGIN}/api/healthz" </dev/null \
  || blocked "public_api_health_failed"

phase="complete"
mutation_started="no"
printf '%s OK commit=%s action=%s backup=%s\n' \
  "$PREFIX" "${STUDIO_EXPECTED_COMMIT:0:12}" "$action" "$backup_file"
