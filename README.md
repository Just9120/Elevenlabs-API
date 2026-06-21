# Elevenlabs-API: транскрибация в Google Docs

Russian-first репозиторий для Google Colab workflow, который транскрибирует audio/video sources в Google Docs, ведёт `manifest` для безопасного пропуска уже обработанных источников и содержит отдельный экспериментальный realtime-контур для проверки browser audio + ElevenLabs realtime STT.

## Текущие продуктовые треки

- **Стабильный batch Colab workflow** — основной путь через `notebooks/elevenlabs_api_colab.ipynb` и `elevenlabs_api.py`: source selection, provider transcription, Google Docs output, `manifest` skip protection, analytics/diagnostics.
- **Docs-only maintenance** — стандартизация уже существующих Google Docs, обслуживание `manifest` и optional speaker project rename без provider/STT/LLM calls.
- **Экспериментальный realtime Colab/proxy contour** — `notebooks/elevenlabs_realtime_colab.ipynb` и `elevenlabs_realtime.py`: отдельная browser page через Colab proxy/new tab, одноразовый token, WebSocket, live browser transcript. Это не замена batch workflow.

## Быстрый старт: batch Colab

1. Откройте Google Colab.
2. Выберите **Open notebook → GitHub**.
3. Укажите `Just9120/Elevenlabs-API` и откройте `notebooks/elevenlabs_api_colab.ipynb`.
4. Оставьте `GITHUB_REF = "main"` или замените его на нужный commit SHA.
5. Запустите notebook cells. Launcher установит зависимости из `requirements-colab.txt`, загрузит `elevenlabs_api.py` из выбранного ref и откроет основной workflow.

Нужные Colab Secrets зависят от provider path:

- `ELEVEN_API_KEY` — preferred key для ElevenLabs (`scribe_v2` и realtime token creation);
- `ELEVENLABS_API_KEY` — compatibility alias для ElevenLabs, если preferred key недоступен;
- `OPENAI_API_KEY` — только для OpenAI paths.

Секреты не должны попадать в logs, `manifest`, analytics или Google Docs.


## Batch provider comparison

- **ElevenLabs batch** is the default UI provider and uses `scribe_v2` with Russian selected by default.
- **OpenAI batch** is an explicit alternative path using `gpt-4o-transcribe` or `gpt-4o-transcribe-diarize`; prepared M4A uploads are split by both size and duration safeguards.

See `docs/provider-transcription-contract.md` for the concise current batch provider contract.

## Realtime experimental status

Realtime Colab prototype is experimental and still requires manual Colab runtime validation. Safety shorthand: single-use token, no Google Docs save, no manifest mutation.

Realtime-контур остаётся экспериментальным. Текущая подтверждённая manual evidence ограничена одним display+microphone run: standalone page boot, display+microphone capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release и WebSocket close.

Не заявляйте полный realtime E2E success: microphone-only, display-only, loopback/virtual input, permission-cancellation behavior (now guarded/static-tested but not manually validated), refreshed-device UX, structured live presentation и cross-browser validation всё ещё требуют ручной проверки. Realtime не сохраняет Google Docs, не читает и не мутирует `manifest`, не интегрируется с speaker projects и использует browser-only `realtime_live_transcript_v1`.

## Навигация по источникам истины

- `docs/project-spec.md` — активный продуктовый contract: scope, durable constraints, runtime boundaries, safety rules.
- `docs/provider-transcription-contract.md` — concise current batch provider contract and manual validation checklist.
- `docs/architecture.md` — observed architecture map и refactor seams для будущей реализации.
- `docs/delivery-plan.md` — краткий operational dashboard, текущий next item и validation blockers.
- `docs/realtime-colab.md` — focused realtime operator guide, validation gaps, troubleshooting и runtime report template.
- `VALIDATION_MATRIX.md` — evidence/status truth table для CI/static/manual validation.
- `docs/ai-coding-workflow.md` — workflow rules для AI-assisted PRs.
- `docs/ci-cd-rules.md` — CI/CD и deployment boundaries; читать только для CI/CD/deploy/ops задач.
- `AGENTS.md` — lightweight routing guide for coding agents.

## Локальная проверка docs/code PR

```bash
python scripts/ci_checks.py
pytest -q
git diff --check
```

Runtime validation выполняется отдельно в Google Colab/Drive/Docs и не доказывается только локальными checks.
