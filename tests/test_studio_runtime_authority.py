from pathlib import Path
import re
import yaml

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def service_block(compose: str, name: str) -> str:
    lines = compose.splitlines()
    start = next(i for i, line in enumerate(lines) if line == f"  {name}:")
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("  ") and not lines[i].startswith("    ")), len(lines))
    return "\n".join(lines[start:end])


def test_authoritative_entrypoints_dockerfiles_and_compose_services_exist():
    for path in [
        "apps/studio/src/main.tsx",
        "apps/studio/nginx.conf",
        "apps/studio/Dockerfile",
        "apps/studio-api/studio_api/main.py",
        "apps/studio-api/studio_api/worker.py",
        "apps/studio-api/studio_api/worker_health.py",
        "apps/studio-api/Dockerfile",
        "deploy/studio/compose.platform.yml",
        "deploy/studio/.env.example",
    ]:
        assert (ROOT / path).exists(), path
    compose = read("deploy/studio/compose.platform.yml")
    service_names = [line[2:-1] for line in compose.splitlines() if re.match(r"^  [A-Za-z0-9_-]+:$", line)]
    for service in ["studio-web", "studio-api", "studio-worker", "postgres", "redis"]:
        assert service_names.count(service) == 1
    assert 'command: ["python", "-m", "studio_api.worker"]' in service_block(compose, "studio-worker")


def test_standard_workflows_do_not_run_production_migration_worker_rollout_provider_or_canary():
    for workflow in (ROOT / ".github/workflows").glob("*.yml"):
        text = workflow.read_text(encoding="utf-8")
        lower = text.lower()
        forbidden = ["controlled canary", "elevenlabs_api_key", "google docs create", "production_live"]
        for fragment in forbidden:
            assert fragment not in lower, f"{workflow} contains {fragment}"
    cd = read(".github/workflows/studio-platform-cd.yml")
    assert "upgrade head" not in cd.lower()
    assert "migrate_studio_platform.sh" not in cd
    assert "worker-only source is manual-only" in cd
    assert "deploy-worker:" in cd
    assert "github.event_name == 'workflow_dispatch'" in cd
    assert "scripts/migrate_studio_platform.sh" not in cd


def test_docs_authority_contract_status_and_no_duplicate_unfinished_retry():
    delivery = read("docs/delivery-plan.md")
    spec = read("docs/project-spec.md")
    architecture = read("docs/architecture.md")
    assert "PWA-SOURCE-DELETION-01" in delivery
    assert "PR #174" in delivery
    assert "6ee51994de90bbfe7852cf1bd7618397b00e52b3" in delivery
    assert "PWA-LEGACY-AUTHORITY-01` — Studio runtime/deployment authority reconciliation — Done/source-complete" in delivery
    unfinished = spec.split("Unfinished or unproven capabilities:", 1)[1].split("The Studio PWA may", 1)[0]
    assert "safe stage-specific retries/recovery" not in unfinished
    assert spec.count("safe stage-specific retries/recovery") <= 1
    for doc in [delivery, spec, architecture, read("docs/runbooks/studio-platform-ops.md")]:
        assert "0014_source_deletion_retention" in doc


def test_redis_never_declared_durable_cleanup_job_lease_authority():
    docs = "\n".join(read(path) for path in ["README.md", "docs/project-spec.md", "docs/delivery-plan.md", "docs/architecture.md", "docs/runbooks/studio-platform-ops.md"])
    forbidden_fragments = [
        "Redis is durable",
        "Redis remains the durable",
        "Redis owns jobs",
        "Redis owns leases",
        "Redis is cleanup authority",
        "Redis is retry authority",
        "Redis is source-retention authority",
        "Redis is output-reconciliation authority",
    ]
    for fragment in forbidden_fragments:
        assert fragment not in docs
    assert "Redis is not durable cleanup authority" in docs
    assert "None for jobs, retries, leases, cleanup, source retention, or output reconciliation" in docs


def test_legacy_runtime_paths_are_marked_with_replacement():
    legacy_paths = [
        "deploy/studio/compose.prod.yml",
        "scripts/deploy_studio.sh",
        "docs/runbooks/legacy-studio-web-deploy.md",
    ]
    for path in legacy_paths:
        text = read(path)
        for marker in ["LEGACY", "COMPATIBILITY ONLY", "NOT AUTHORITATIVE FOR PRODUCTION", "Replacement"]:
            assert marker in text, f"{path} missing {marker}"
        assert "Removal condition" in text
    architecture = read("docs/architecture.md")
    assert "deploy/studio/compose.prod.yml` | `compatibility-only` / `legacy-deprecated`" in architecture
    assert "No legacy paths were removed" in read("docs/delivery-plan.md")



def workflow_paths(path: str) -> list[str]:
    workflow = yaml.load((ROOT / path).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    on_block = workflow.get("on", {})
    paths: list[str] = []
    for event in ("pull_request", "push"):
        event_block = on_block.get(event, {})
        if isinstance(event_block, dict):
            paths.extend(event_block.get("paths", []) or [])
    return paths


def test_workflow_path_filters_reference_existing_repository_paths_and_authority_docs():
    all_paths: list[tuple[str, str]] = []
    for workflow in (ROOT / ".github/workflows").glob("*.yml"):
        for entry in workflow_paths(str(workflow.relative_to(ROOT))):
            all_paths.append((str(workflow.relative_to(ROOT)), entry))
            literal_prefix = entry.split("*", 1)[0].rstrip("/")
            candidate = ROOT / literal_prefix
            if "*" in entry:
                assert candidate.exists(), f"{workflow} glob parent missing: {entry}"
            else:
                assert (ROOT / entry).exists(), f"{workflow} literal path missing: {entry}"

    flattened = [entry for _, entry in all_paths]
    assert "docs/runbooks/studio-deploy.md" not in flattened
    assert "docs/runbooks/legacy-studio-web-deploy.md" in flattened
    studio_ci_paths = workflow_paths(".github/workflows/studio-ci.yml")
    for authority_path in [
        "docs/architecture.md",
        "docs/delivery-plan.md",
        "docs/project-spec.md",
        "docs/studio-processing-contract.md",
        "README.md",
        "tests/test_studio_runtime_authority.py",
    ]:
        assert authority_path in studio_ci_paths
    assert "docs/delivery-plan-archive.md" not in flattened
