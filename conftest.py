from __future__ import annotations

from pathlib import Path


PORTABLE_EXCLUDED_TEST_MODULES = frozenset(
    {
        "test_backup_studio_postgres_r2.py",
        "test_manage_studio_worker.py",
        "test_studio_api_core.py",
        "test_studio_platform_component_deploy.py",
        "test_studio_processing_e2e.py",
        "test_studio_processing_preflight.py",
    }
)


def pytest_addoption(parser) -> None:
    group = parser.getgroup("repository profiles")
    group.addoption(
        "--portable",
        action="store_true",
        default=False,
        help="Run the cross-platform suite without PostgreSQL/Redis or bash integration modules.",
    )


def pytest_ignore_collect(collection_path: Path, config):
    if not config.getoption("--portable"):
        return None
    return collection_path.name in PORTABLE_EXCLUDED_TEST_MODULES


def pytest_report_header(config):
    if not config.getoption("--portable"):
        return None
    excluded = ", ".join(sorted(PORTABLE_EXCLUDED_TEST_MODULES))
    return f"portable profile excludes service/shell integration modules: {excluded}"
