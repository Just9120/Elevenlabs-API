from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CI = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
STUDIO_CI = (ROOT / ".github/workflows/studio-ci.yml").read_text(encoding="utf-8")


def test_ci_caches_reproducible_dependencies_without_skipping_validation() -> None:
    assert "cache: pip" in CI
    assert "requirements-dev.txt" in CI
    assert "constraints-dev.txt" in CI
    assert "python scripts/ci_checks.py" in CI
    assert "python -X faulthandler -m pytest -vv" in CI

    assert "cache: pip" in STUDIO_CI
    assert "apps/studio-api/requirements.txt" in STUDIO_CI
    assert "apps/studio-api/constraints.txt" in STUDIO_CI
    assert "npm run lint" in STUDIO_CI
    assert "npm run test -- --run" in STUDIO_CI
    assert "npm run build" in STUDIO_CI
    assert "npm run test:e2e" in STUDIO_CI
    assert "continue-on-error:" not in CI
    assert "continue-on-error:" not in STUDIO_CI


def test_service_health_polling_preserves_the_total_retry_window() -> None:
    for workflow in (CI, STUDIO_CI):
        assert workflow.count("--health-interval 2s") == 2
        assert workflow.count("--health-retries 25") == 2
        assert "--health-interval 10s" not in workflow
        assert "--health-retries 5" not in workflow


def test_studio_ci_uses_exact_browser_and_content_addressed_image_caches() -> None:
    assert "path: ~/.cache/ms-playwright" in STUDIO_CI
    assert (
        "key: ${{ runner.os }}-playwright-chromium-"
        "${{ hashFiles('apps/studio/package-lock.json') }}"
        in STUDIO_CI
    )
    assert "restore-keys:" not in STUDIO_CI
    assert "id: playwright-cache" in STUDIO_CI
    assert "if: steps.playwright-cache.outputs.cache-hit != 'true'" in STUDIO_CI

    assert "DOCKER_BUILD_RECORD_UPLOAD: 'false'" in STUDIO_CI
    assert STUDIO_CI.count("load: true") == 2
    for component in ("web", "api"):
        assert f"tags: elevenlabs-studio-{component}:test" in STUDIO_CI
        assert f"cache-from: type=gha,scope=studio-{component}" in STUDIO_CI
        assert (
            "cache-to: ${{ github.event_name != 'pull_request' && "
            f"'type=gha,mode=max,scope=studio-{component}' || '' }}}}"
        ) in STUDIO_CI
    assert STUDIO_CI.count("provenance: false") == 2
    assert STUDIO_CI.count("sbom: false") == 2


def test_only_superseded_pull_request_runs_are_cancelled() -> None:
    expression = "cancel-in-progress: ${{ github.event_name == 'pull_request' }}"
    assert expression in CI
    assert expression in STUDIO_CI
    group_key = "${{ github.event_name == 'pull_request' && github.ref || github.sha }}"
    assert f"group: ci-{group_key}" in CI
    assert f"group: studio-ci-{group_key}" in STUDIO_CI
