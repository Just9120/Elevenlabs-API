from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    ("context", "required_exclusions", "required_inputs"),
    (
        (
            "apps/studio",
            {
                "node_modules/",
                "dist/",
                "coverage/",
                "test-results/",
                "playwright-report/",
                "*.tsbuildinfo",
                ".env",
                ".env.*",
            },
            {
                "package.json",
                "package-lock.json",
                "src",
                "public",
                "index.html",
                "nginx.conf",
                "tsconfig.json",
                "vite.config.ts",
            },
        ),
        (
            "apps/studio-api",
            {
                "__pycache__/",
                "*.py[cod]",
                ".pytest_cache/",
                ".venv/",
                "coverage.xml",
                "htmlcov/",
                "test-results/",
                ".env",
                ".env.*",
            },
            {
                "requirements.txt",
                "constraints.txt",
                "studio_api",
                "alembic",
                "alembic.ini",
            },
        ),
    ),
)
def test_studio_docker_context_excludes_local_artifacts_without_hiding_inputs(
    context: str,
    required_exclusions: set[str],
    required_inputs: set[str],
) -> None:
    context_root = ROOT / context
    patterns = {
        line.strip()
        for line in (context_root / ".dockerignore").read_text(
            encoding="utf-8",
        ).splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }

    assert required_exclusions <= patterns
    assert not {"*", "**", "**/*"} & patterns
    assert not required_inputs & patterns
    assert all((context_root / path).exists() for path in required_inputs)
