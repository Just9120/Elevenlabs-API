# ElevenLabs API / VoiceOps Studio

VoiceOps — система транскрибации с двумя production-продуктами:

1. **Google Colab** — batch-транскрибации в Google Docs и realtime-транскрибация в окне браузера.
2. **VoiceOps Studio PWA** — web-приложение с отдельной подготовкой WAV/FLAC до транскрибации, batch и realtime, авторизацией, Google Drive, Cloudflare R2, worker processing, history, analytics и diagnostics.

Colab batch используется около четырёх месяцев и в целом стабилен. VoiceOps Studio PWA активно развивается; выполненный source-level scope не считается production READY до exact-revision CI, deployment и bounded LIVE validation.

README не дублирует быстро устаревающие проценты и revision IDs. Актуальные numerator/denominator, atomic acceptance criteria, Evidence и метод расчёта находятся в [docs/project-spec.md](docs/project-spec.md), а текущая и предыдущая независимые оценки, active Goal, blockers и checkpoint — в [docs/delivery-plan.md](docs/delivery-plan.md).

Commercial production включён в durable product scope как `BACKLOG`, но его implementation пока не авторизована. Существующий personal code не считается commercial Evidence.

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
npm run test -- --run
npm run build

# Проверка whitespace/diff
git diff --check
```

Colab batch запускается вручную через `notebooks/elevenlabs_api_colab.ipynb`. Он поддерживает Drive/local file intake, bounded local-folder intake, `ru`/`en`/auto language modes, speaker diarization, Google Docs output и duplicate-protection manifest; destructive manifest clear вынесен в dry-run-first flow с backup и точным подтверждением. Realtime Colab проверяется по отдельному runbook. Studio production operations выполняются только по project CI/CD contract и operational runbook.

## Canonical и operational документы

| Документ | Назначение |
|---|---|
| [Upstream requirements](https://docs.google.com/document/d/1uaYvnqpbns_iyHTtQDZYjNYygT4ikUhmhuhRDWySrzI/edit?tab=t.0) | Сырые/несогласованные требования и идеи для reconciliation; не canonical contract и не implementation authorization. |
| [AGENTS.md](AGENTS.md) | Goal-driven repository router, execution kernel, authority и scope. |
| [docs/project-spec.md](docs/project-spec.md) | Canonical product contract, эпики и atomic AC. |
| [docs/delivery-plan.md](docs/delivery-plan.md) | Живой dashboard, readiness, blockers и active checkpoint. |
| [docs/delivery-plan-archive.md](docs/delivery-plan-archive.md) | Архив завершённой delivery history. |
| [docs/ci-cd-rules.md](docs/ci-cd-rules.md) | CI/CD, deployment, migration и runtime safety contract. |
| [docs/architecture.md](docs/architecture.md) | Logical/runtime architecture, data flow и state ownership. |
| [docs/studio-processing-contract.md](docs/studio-processing-contract.md) | Детальные Studio processing invariants. |
| [SECURITY.md](SECURITY.md) | Security reporting, safe research boundaries и authority routing. |
| [docs/runbooks/validation.md](docs/runbooks/validation.md) | Repository и component validation commands. |
| [docs/runbooks/studio-platform-ops.md](docs/runbooks/studio-platform-ops.md) | Studio rollout и production operations. |
| [docs/runbooks/realtime-colab.md](docs/runbooks/realtime-colab.md) | Realtime Colab prototype и manual runtime validation. |

## Historical и supporting evidence

Dated audits фиксируют состояние на указанный revision/date. Они не являются current source of truth, readiness input или implementation authorization.

| Документ | Назначение |
|---|---|
| [docs/audits/repository-audit-2026-08-27.md](docs/audits/repository-audit-2026-08-27.md) | Evidence-based audit на pre-PR `#245` baseline; findings и gaps. |
| [docs/audits/repository-audit-2026-07-26.md](docs/audits/repository-audit-2026-07-26.md) | Исторический audit supporting evidence. |
| [docs/audits/repository-audit-2026-07-21.md](docs/audits/repository-audit-2026-07-21.md) | Более ранний historical audit, перенесённый из operational runbooks. |

Опциональные `docs/utility/context-bundle-builder.md` и `docs/ai-delivery-infrastructure-plan.md` в текущем repository отсутствуют; их содержание не предполагается.

## Границы статусов

- Source presence не равна production LIVE.
- CI success не равен deployment success.
- `READY` требует `100%` AC и все обязательные `SPEC | CODE | TEST | CI | DEPLOY | LIVE` Evidence.
- Exact current percentages и Evidence не копируются из archive — они пересчитываются по коду, тестам, CI/CD и доступному runtime evidence.
