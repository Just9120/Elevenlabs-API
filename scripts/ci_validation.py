"""Secretless CI selection, bounded identity proof and trusted-main CD gate.

Reuse concerns test results only: no executable PR artifact reaches deployment.
Any unavailable or ambiguous reuse evidence falls back to a complete suite.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import zipfile

REPOSITORY = "Just9120/Elevenlabs-API"
WORKFLOW = ".github/workflows/ci.yml"
PROOF_NAME = "ci-validation-identity"
CONTEXT_FILES = (WORKFLOW, ".github/workflows/studio-ci.yml", "scripts/ci_validation.py")
SHA = re.compile(r"^[0-9a-f]{40}$")


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def validation_context() -> str:
    digest = hashlib.sha256()
    for name in CONTEXT_FILES:
        digest.update(name.encode())
        digest.update(Path(name).read_bytes())
    digest.update(json.dumps(runner_context(), sort_keys=True).encode())
    return digest.hexdigest()


def runner_context() -> dict:
    return {key: os.environ.get(key) for key in ("RUNNER_OS", "RUNNER_ARCH", "ImageOS", "ImageVersion")}


class NoCredentialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlparse(newurl)
        if parsed.scheme != "https" or not parsed.hostname or not (
            parsed.hostname.endswith(".blob.core.windows.net")
            or parsed.hostname.endswith(".actions.githubusercontent.com")
            or parsed.hostname in {"api.github.com", "github.com"}
        ):
            raise ValueError("untrusted artifact redirect")
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected:
            redirected.remove_header("Authorization")
        return redirected


class GitHub:
    def request(self, path: str, *, binary: bool = False):
        # The only authenticated origin is fixed; never accept an artifact URL.
        if not path.startswith("/") or ".." in path or "?" == path:
            raise ValueError("invalid API path")
        req = urllib.request.Request("https://api.github.com" + path, headers={
            "Authorization": "Bearer " + os.environ["GH_TOKEN"],
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        limit = 1_048_576 if binary else 4_194_304
        with urllib.request.build_opener(NoCredentialRedirect()).open(req, timeout=25) as response:
            data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("oversized API evidence")
        return data if binary else json.loads(data)

    def pages(self, suffix: str, key: str | None = None):
        separator = "&" if "?" in suffix else "?"
        # Never treat a truncated result as complete; fallback/fail closed.
        for page in range(1, 11):
            data = self.request(f"/repos/{REPOSITORY}/{suffix}{separator}per_page=100&page={page}")
            rows = data[key] if key else data
            yield from rows
            if len(rows) < 100:
                return
        raise ValueError("evidence pagination exceeds bound")


def required_run(api: GitHub, run: dict, sha: str, event: str) -> bool:
    if not (SHA.fullmatch(sha) and run.get("head_sha") == sha
            and run.get("event") == event and run.get("status") == "completed"
            and run.get("conclusion") == "success"
            and run.get("path", "").split("@")[0] == WORKFLOW
            and run.get("repository", {}).get("full_name") == REPOSITORY
            and run.get("head_repository", {}).get("full_name") == REPOSITORY):
        return False
    jobs = list(api.pages(f"actions/runs/{int(run['id'])}/jobs?filter=latest", "jobs"))
    gates = [job for job in jobs if job.get("name") == "ci-required"]
    return len(gates) == 1 and gates[0].get("conclusion") == "success"


def read_proof(api: GitHub, run_id: int) -> dict:
    artifacts = list(api.pages(f"actions/runs/{run_id}/artifacts", "artifacts"))
    proofs = [a for a in artifacts if a.get("name") == PROOF_NAME and not a.get("expired")]
    if len(proofs) != 1 or proofs[0].get("size_in_bytes", 0) > 65_536:
        raise ValueError("missing or ambiguous validation proof")
    data = api.request(f"/repos/{REPOSITORY}/actions/artifacts/{int(proofs[0]['id'])}/zip", binary=True)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) != 1 or entries[0].filename != "identity.json" or entries[0].file_size > 16_384:
            raise ValueError("invalid proof archive")
        return json.loads(archive.read(entries[0]))


def verify_reuse(api: GitHub, target: str) -> int | None:
    # A label such as ubuntu-latest is insufficient when the host image changes.
    if not all(runner_context().values()):
        return None
    target_commit = api.request(f"/repos/{REPOSITORY}/git/commits/{target}")
    parents = target_commit.get("parents", [])
    if len(parents) != 1:  # squash/rebase only; merge commits use full validation
        return None
    base = parents[0]["sha"]
    tree = target_commit["tree"]["sha"]
    prs = list(api.pages(f"commits/{target}/pulls"))
    for pr in prs:
        if not (pr.get("merged_at") and pr.get("merge_commit_sha") == target
                and pr.get("base", {}).get("ref") == "main"
                and pr.get("head", {}).get("repo", {}).get("full_name") == REPOSITORY):
            continue
        head = pr["head"]["sha"]
        for run in api.pages(f"actions/workflows/ci.yml/runs?event=pull_request&head_sha={head}", "workflow_runs"):
            if not required_run(api, run, head, "pull_request"):
                continue
            proof = read_proof(api, int(run["id"]))
            if not (proof.get("schema") == 1 and proof.get("mode") == "full"
                    and proof.get("run_id") == int(run["id"])
                    and proof.get("repository") == REPOSITORY and proof.get("head") == head
                    and proof.get("base") == base and proof.get("tree") == tree
                    and proof.get("runner") == runner_context()
                    and isinstance(proof.get("suite_runners"), list)
                    and proof["suite_runners"]
                    and all(value == runner_context() for value in proof["suite_runners"])
                    and proof.get("context") == validation_context()
                    and SHA.fullmatch(str(proof.get("checkout", "")))):
                continue
            checked = api.request(f"/repos/{REPOSITORY}/git/commits/{proof['checkout']}")
            if (checked["tree"]["sha"] == tree
                    and {p["sha"] for p in checked.get("parents", [])} == {base, head}):
                return int(run["id"])
    return None


def select(paths: list[str]) -> tuple[bool, bool]:
    # Only strictly recognized prose changes are exempt from executable suites.
    docs_only = bool(paths) and all(
        (p.startswith("docs/") and p.endswith(".md")) or p in {"README.md", "AGENTS.md"}
        for p in paths
    )
    root = not docs_only
    studio = root and any(p.startswith(("apps/", "deploy/", ".github/", "scripts/", "tests/", "requirements", "constraints")) for p in paths)
    return root, studio


def output(**values) -> None:
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as file:
        for key, value in values.items():
            file.write(f"{key}={str(value).lower() if isinstance(value, bool) else value}\n")


def plan(api: GitHub, event: dict) -> None:
    mode, reason, reused = "full", "applicable suites", None
    if os.environ["GITHUB_EVENT_NAME"] == "push":
        try:
            reused = verify_reuse(api, os.environ["GITHUB_SHA"])
            if not reused:
                reason = "full suites: equivalent successful PR/source/runner proof not established"
        except (ValueError, KeyError, OSError, zipfile.BadZipFile):
            reason = "reuse evidence unavailable: full validation"
    if reused:
        root = studio = False
        mode, reason = "reused", f"equivalent full PR validation run {reused}"
    else:
        base = event.get("pull_request", {}).get("base", {}).get("sha") or event.get("before")
        if base and SHA.fullmatch(base) and base != "0" * 40:
            paths = git("diff", "--name-only", base, "HEAD").splitlines()
            root, studio = select(paths)
            if not root:
                mode, reason = "docs", "recognized Markdown-only changes; lightweight checks required"
        else:
            root = studio = True
    output(root=root, studio=studio, mode=mode)
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as file:
        file.write(f"## Validation selection\n\n{reason}. Root: {root}; Studio: {studio}.\n")


def proof(event: dict, mode: str) -> None:
    pr = event.get("pull_request", {})
    runners = [json.loads(os.environ[key]) for key in ("ROOT_RUNNER_JSON", "STUDIO_RUNNER_JSON", "BROWSER_RUNNER_JSON") if os.environ.get(key)]
    data = dict(schema=1, mode=mode, repository=REPOSITORY,
                run_id=int(os.environ["GITHUB_RUN_ID"]), checkout=git("rev-parse", "HEAD"),
                tree=git("rev-parse", "HEAD^{tree}"), context=validation_context(),
                runner=runner_context(),
                suite_runners=runners,
                head=pr.get("head", {}).get("sha"), base=pr.get("base", {}).get("sha"))
    Path(os.environ["RUNNER_TEMP"], "identity.json").write_text(json.dumps(data), encoding="utf-8")


def deploy_gate(api: GitHub, event: dict) -> None:
    if os.environ["GITHUB_REPOSITORY"] != REPOSITORY:
        raise ValueError("foreign repository")
    main = api.request(f"/repos/{REPOSITORY}/git/ref/heads/main")["object"]["sha"]
    if os.environ["GITHUB_EVENT_NAME"] == "workflow_run":
        run_id = event["workflow_run"]["id"]
        run = api.request(f"/repos/{REPOSITORY}/actions/runs/{int(run_id)}")
        valid = run.get("head_branch") == "main" and required_run(api, run, main, "push")
    else:
        if os.environ["GITHUB_REF"] != "refs/heads/main" or os.environ["GITHUB_SHA"] != main:
            raise ValueError("manual deployment requires current main")
        valid = any(r.get("head_branch") == "main" and required_run(api, r, main, "push")
                    for r in api.pages(f"actions/workflows/ci.yml/runs?event=push&head_sha={main}", "workflow_runs"))
    if not valid:
        raise ValueError("current main lacks successful required CI; deployment denied")
    output(revision=main)


def metrics(api: GitHub) -> None:
    run_id = int(os.environ["GITHUB_RUN_ID"])
    jobs = list(api.pages(f"actions/runs/{run_id}/jobs?filter=all", "jobs"))
    durations = []
    def stamp(value):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    for job in jobs:
        if job.get("started_at") and job.get("completed_at"):
            durations.append((stamp(job["completed_at"]) - stamp(job["started_at"])).total_seconds())
    starts = [stamp(j["started_at"]) for j in jobs if j.get("started_at")]
    finishes = [stamp(j["completed_at"]) for j in jobs if j.get("completed_at")]
    elapsed = (max(finishes) - min(starts)).total_seconds() if starts and finishes else 0
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as file:
        file.write(f"\n## CI cost snapshot\n\nCompleted job runner seconds: {sum(durations):.0f}; elapsed to last completed job: {elapsed:.0f}s. Excludes this running report job; includes prior attempts.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("plan", "proof", "deploy-gate", "metrics", "runner-context"))
    parser.add_argument("--mode", default="full")
    args = parser.parse_args()
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    if args.command == "runner-context":
        output(runner=json.dumps(runner_context(), sort_keys=True, separators=(",", ":")))
    elif args.command == "proof":
        proof(event, args.mode)
    elif args.command == "plan":
        plan(GitHub(), event)
    elif args.command == "deploy-gate":
        deploy_gate(GitHub(), event)
    else:
        metrics(GitHub())
