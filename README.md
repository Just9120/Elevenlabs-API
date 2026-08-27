# ElevenLabs API / VoiceOps Studio

VoiceOps — система транскрибации с двумя production-продуктами:

1. **Google Colab** — batch-транскрибации в Google Docs и realtime-транскрибация в окне браузера.
2. **VoiceOps Studio PWA** — web-приложение с отдельной подготовкой WAV/FLAC до транскрибации, batch и realtime, авторизацией, Google Drive, Cloudflare R2, worker processing, history, analytics и diagnostics.

Colab batch используется около четырёх месяцев и в целом стабилен. VoiceOps Studio PWA активно развивается; выполненный source-level scope не считается production READY до exact-revision CI, deployment и bounded LIVE validation.

Актуальная независимо пересчитанная готовность current scope для `main@18cbd46e9361a66bfbc1f2265d0820aa72aedf50`:

- Google Colab: **100% (`29/29`)**.
- VoiceOps Studio PWA: **99,2% (`118/119`)**.
- согласованный current canonical scope: **99,3% (`147/148`)**.
- полный scope upstream requirements: **не рассчитан — `SPEC RECONCILIATION REQUIRED`**.

`147/148` не означает готовность всей заявленной product vision: это только denominator уже согласованных atomic AC в `docs/project-spec.md`. В текущей `PWA-GOOGLE-PICKER-UX-01` локально реализованы viewport-stable Picker и background scroll lifecycle; выбор текущей/empty target folder остаётся `0/1`. Upstream Google Doc содержит и другие новые/частично конфликтующие требования, которые должны пройти reconciliation до полного расчёта. Предыдущая source-cache Goal merged/deployed, но её owner-controlled authenticated `LIVE` остаётся отдельным archived external gate.

Owner decision от 2026-08-27: commercial production включён в durable product scope как `BACKLOG`, но его implementation пока не авторизована. До завершения atomic decomposition общий project percentage остаётся `N/A`.

Numerator/denominator, atomic acceptance criteria, Evidence и метод расчёта находятся в [docs/project-spec.md](docs/project-spec.md). Текущий delivery checkpoint и следующий шаг — в [docs/delivery-plan.md](docs/delivery-plan.md).

## Быстрый старт и validation

```bash
# Lightweight repository checks
python scripts/ci_checks.py

# Python tests
pytest -q

# VoiceOps Studio PWA
cd apps/studio
npm ci
npm run lint
npm test -- --run
npm run build

# Проверка whitespace/diff
git diff --check
```

Colab batch запускается вручную через `notebooks/elevenlabs_api_colab.ipynb`. Он поддерживает Drive/local file intake, bounded local-folder intake, `ru`/`en`/auto language modes, speaker diarization, Google Docs output и duplicate-protection manifest; destructive manifest clear вынесен в dry-run-first flow с backup и точным подтверждением. Realtime Colab проверяется по отдельному runbook. Studio production operations выполняются только по project CI/CD contract и operational runbook.

## Canonical и operational документы

| Документ | Назначение |
|---|---|
| [AGENTS.md](AGENTS.md) | Goal-driven repository router, execution kernel, authority и scope. |
| [docs/project-spec.md](docs/project-spec.md) | Canonical product contract, эпики и atomic AC. |
| [docs/delivery-plan.md](docs/delivery-plan.md) | Живой dashboard, readiness, blockers и active checkpoint. |
| [docs/delivery-plan-archive.md](docs/delivery-plan-archive.md) | Архив завершённой delivery history. |
| [docs/ci-cd-rules.md](docs/ci-cd-rules.md) | CI/CD, deployment, migration и runtime safety contract. |
| [docs/architecture.md](docs/architecture.md) | Logical/runtime architecture, data flow и state ownership. |
| [docs/studio-processing-contract.md](docs/studio-processing-contract.md) | Детальные Studio processing invariants. |
| [docs/runbooks/validation.md](docs/runbooks/validation.md) | Repository и component validation commands. |
| [docs/runbooks/studio-platform-ops.md](docs/runbooks/studio-platform-ops.md) | Studio rollout и production operations. |
| [docs/runbooks/realtime-colab.md](docs/runbooks/realtime-colab.md) | Realtime Colab prototype и manual runtime validation. |
| [docs/audits/repository-audit-2026-08-27.md](docs/audits/repository-audit-2026-08-27.md) | Актуальный evidence-based audit; findings, readiness, gaps и proposed next Goal. |
| [docs/audits/repository-audit-2026-07-26.md](docs/audits/repository-audit-2026-07-26.md) | Исторический dated audit; supporting evidence, не current authority. |

Опциональные `docs/utility/context-bundle-builder.md` и `docs/ai-delivery-infrastructure-plan.md` в текущем repository отсутствуют; их содержание не предполагается.

## Границы статусов

- Source presence не равна production LIVE.
- CI success не равен deployment success.
- `READY` требует `100%` AC и все обязательные `SPEC | CODE | TEST | CI | DEPLOY | LIVE` Evidence.
- Exact current percentages и Evidence не копируются из archive — они пересчитываются по коду, тестам, CI/CD и доступному runtime evidence.
