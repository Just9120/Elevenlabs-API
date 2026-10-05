from __future__ import annotations

from pathlib import Path
import os

from scripts.test_shell_environment import configure_test_shell

# Before test modules perform shell discovery or build subprocess environments.
# This affects only this pytest process and its children, never the user's PATH.
configure_test_shell(os.environ)


PORTABLE_EXCLUDED_TEST_MODULES = frozenset(
    {
        "test_backup_studio_postgres_r2.py",
        "test_manage_studio_worker.py",
        "test_migrate_studio_platform.py",
        "test_studio_migration_release.py",
        "test_studio_api_core.py",
        "test_studio_platform_component_deploy.py",
        "test_studio_processing_e2e.py",
        "test_studio_processing_preflight.py",
        "test_studio_worker_db_role_integration.py",
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
