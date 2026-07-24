from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "apps/studio"


def test_browser_e2e_uses_real_browser_api_and_isolated_service_state() -> None:
    package = json.loads((STUDIO / "package.json").read_text(encoding="utf-8"))
    vite = (STUDIO / "vite.config.ts").read_text(encoding="utf-8")
    playwright = (STUDIO / "playwright.config.ts").read_text(encoding="utf-8")
    workflow = (ROOT / ".github/workflows/studio-ci.yml").read_text(
        encoding="utf-8"
    )

    assert package["scripts"]["test:e2e"] == "playwright test"
    assert package["devDependencies"]["@playwright/test"] == "1.61.1"
    assert package["overrides"]["fast-uri"] == "3.1.4"
    assert "'/api': 'http://127.0.0.1:8000'" in vite
    assert "python -m uvicorn studio_api.main:app" in playwright
    assert "cwd: '../..'" in playwright
    assert "browserName: 'chromium'" in playwright

    assert "browser-e2e:" in workflow
    assert "POSTGRES_DB: studio_browser_e2e" in workflow
    assert "image: redis:7-alpine" in workflow
    assert "STUDIO_ENVIRONMENT: test" in workflow
    assert "STUDIO_APP_ORIGIN: http://127.0.0.1:4173" in workflow
    assert "STUDIO_COOKIE_NAME: studio_e2e_session" in workflow
    assert "alembic -c apps/studio-api/alembic.ini upgrade head" in workflow
    assert "python tests/support/studio_browser_e2e_seed.py" in workflow
    assert "'tests/test_studio_browser_e2e_contract.py'" in workflow
    assert "npx playwright install --with-deps chromium" in workflow
    assert "npm run test:e2e" in workflow
    assert "uses: actions/upload-artifact@v4" in workflow
    assert "path: apps/studio/test-results" in workflow
    assert "if-no-files-found: warn" in workflow


def test_browser_e2e_seed_guards_before_database_initialization() -> None:
    seed = (ROOT / "tests/support/studio_browser_e2e_seed.py").read_text(
        encoding="utf-8"
    )
    seed_body = seed.split("def seed() -> None:", 1)[1]

    assert 'E2E_DATABASE_NAME = "studio_browser_e2e"' in seed
    assert 'settings.environment != "test"' in seed
    assert 'settings.database_host not in {"127.0.0.1", "localhost"}' in seed
    assert seed_body.index("_require_isolated_database()") < seed_body.index(
        "from studio_api.db import SessionLocal"
    )
    assert "db.query(User.id).first() is not None" in seed
    assert "requires an empty database" in seed
    assert "status=JobSourceStatus.queued" in seed
    assert "TranscriptionJobOutput(" in seed
