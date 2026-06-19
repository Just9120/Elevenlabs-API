# Delivery plan: Elevenlabs-API

## Статус

Документ фиксирует текущий operational plan. Он не является историческим журналом всех PR; для validation evidence используется `VALIDATION_MATRIX.md`, для требований — `docs/project-spec.md`, а для focused coding-agent routing — `AGENTS.md`.

Текущая фаза: batch Colab remains the working/fallback channel, while realtime work is a separate experimental contour. `LIVE-COLAB-01` output-cell UI is blocked in the tested Colab runtime, and `LIVE-COLAB-PROXY-01` is the next bridge validation step using a standalone page via Colab proxy/new tab. Generated `/realtime.js` syntax has static/generated-JS validation, but runtime validation in Google Colab/Drive/Docs and realtime browser/provider validation must not be overstated.

## Готово к текущему checkpoint

### Документация и правила проекта

- [x] README переформатирован как Russian-first user guide.
- [x] `docs/project-spec.md` используется как главный source of truth по scope, flows, safety и validation boundaries.
- [x] `VALIDATION_MATRIX.md` используется как truth table по evidence/status.
- [x] Docs-only maintenance boundaries отделены от runtime transcription behavior.

### Source picker и Drive UX

- [x] Drive picker/source UX fixes внесены в main.
- [x] Source folder и destination/output folder описаны как разные concepts.
- [x] Google Drive picker buttons зафиксированы как primary reliable path.
- [x] Double-click описан как convenience, а не обязательный path.
- [x] `drive_multi` сохраняет explicit/button-based fallback и не превращается в folder scan.

### Conflict handling и manifest safety

- [x] Conflict default переведен на safe skip / `Пропустить`.
- [x] Manifest skip protection остается отдельной safety boundary от provider calls.
- [x] Manifest maintenance описан как reconciliation/refresh, а не основной путь регистрации новых transcription Docs.
- [x] Safety caveat сохранен: no transcript body and no Google Docs body content in `manifest`/analytics.

### Docs-only workflows

- [x] Existing Google Docs standardization описана как docs-only workflow.
- [x] Manifest maintenance описан как docs-only workflow.
- [x] Docs-only workflows явно не вызывают provider/STT/LLM APIs.

### Diagnostics и startup timing

- [x] Startup timing instrumentation добавлен в текущий scope.
- [x] Startup timing summary описан как diagnostic signal, а не доказательство успешной транскрибации.

### Optional speaker project rename MVP

- [x] Optional speaker project workflow после diarized Google Docs добавлен в scope main после PR #47.
- [x] Workflow зафиксирован как post-processing, не часть транскрибации.
- [x] `Speakers: no` блокирует workflow; `Speakers: yes` допускает workflow при detected labels; unknown metadata допускается только с warning при detected labels.
- [x] Mapping выполняется вручную пользователем.
- [x] Workflow не является voice identification и не использует voice samples, voiceprints, embeddings или biometric matching.
- [x] Roster хранится отдельно: `VoiceOps Workspace/projects/speaker_projects.json`.
- [x] Apply explicit; unmapped labels remain unchanged.
- [x] MVP caveat сохранен: apply переписывает Google Doc как plain text и требует проверки на копиях.

## Следующий runtime checkpoint

### LIVE-COLAB-PROXY-01: standalone realtime frontend bridge

Цель: validate the next realtime bridge by using Colab only as a Python launcher/local HTTP server and opening a standalone browser page through the Colab proxy/new tab. This is closer to future PWA architecture because frontend logic is not coupled to notebook output-cell JavaScript, but it remains separate from the batch Colab workflow and does not depend on future PWA/backend code.

Implementation status:

- [x] Add proxy/new-tab launcher path in `elevenlabs_realtime.py`.
- [x] Serve a standalone realtime browser page from a lightweight local HTTP server.
- [x] Keep browser exposure limited to a one-time realtime token or generated realtime WebSocket URL.
- [x] Static/generated-JS validation covers generated `/realtime.js` syntax, Stop status preservation, failed mixed-capture cleanup, Russian-first UI copy, source controls, and browser-only `realtime_live_transcript_v1` committed segments.
- [x] Document output-cell UI attempts as blocked in tested Colab runtime.
- [x] One manual Colab proxy/new-tab run confirmed page boot, display+microphone capture, WebSocket open, ElevenLabs `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close.
- [ ] Microphone-only, display-only, virtual-input/loopback, refreshed-device UX, structured live presentation, and all-browser coverage remain pending; do not claim full realtime E2E validation.

Manual runtime checklist:

- [ ] Launcher creates a one-time realtime token using preferred `ELEVEN_API_KEY`, with `ELEVENLABS_API_KEY` only as compatibility alias.
- [ ] Launcher starts the local HTTP server and displays `Открыть realtime-страницу в новой вкладке`.
- [ ] Link uses a Colab proxy URL when available, or shows the Russian fallback instruction when unavailable.
- [ ] Standalone page opens in a normal browser tab/window and shows `Статус: страница загружена`, then `Статус: Готово`.
- [ ] Start changes status to `Статус: Запуск…`; WebSocket open changes status to `Статус: Соединение установлено`; ElevenLabs session events show `Статус: Сессия распознавания запущена` where applicable, with `session_started` in diagnostics.
- [ ] Provider VAD (`commit_strategy=vad`) controls partial-to-committed transitions; no local “seven lines” threshold is used.
- [ ] Committed events render as ordered browser-only `realtime_live_transcript_v1` segments; this is not Google Docs standardization and does not create Docs or mutate `manifest`.
- [ ] Independent `Аудио вкладки / экрана` and `Микрофон / аудиовход` controls behave as documented for microphone-only, display-only, display+input mixing, and virtual/loopback devices selected as audio inputs.
- [ ] Без сохранения в Google Docs, без мутаций `manifest`, без интеграции проектов спикеров и без раскрытия основного ключа API.

### LIVE-COLAB-01: Realtime Colab prototype

Цель: validate the first experimental realtime Colab prototype for live browser audio capture + ElevenLabs realtime STT. This is separate from the batch workflow and must not save to Google Docs, mutate `manifest`, or integrate проекты спикеров.

Implementation status:

- [x] Create realtime notebook `notebooks/elevenlabs_realtime_colab.ipynb`.
- [x] Create standalone realtime runtime file `elevenlabs_realtime.py`.
- [x] Static/local checks for notebook hygiene, helper behavior and safety guardrails passed for the implementation.
- [ ] Output-cell UI validation is blocked in the tested Colab runtime; do not continue treating output-cell JavaScript as the active validation path.

Manual runtime checklist:

- [ ] Token creation works in live Colab with preferred `ELEVEN_API_KEY` from Colab Secrets, with `ELEVENLABS_API_KEY` accepted only as a compatibility alias.
- [ ] Mic mode starts in a real browser/Colab session.
- [ ] Display audio mode detects an audio track or shows the required clear Russian error.
- [ ] Display + mic mode mixes both streams and warns about echo/double audio.
- [ ] Virtual input/loopback device route is visible and usable if available.
- [ ] WebSocket opens against ElevenLabs realtime endpoint.
- [ ] Partial transcript appears.
- [ ] Committed transcript appears.
- [ ] Stop releases tracks and closes WebSocket.
- [ ] No API key in JS; browser receives only one-time realtime token.
- [ ] No `manifest` or Google Docs mutations.

Next steps:

1. Use `LIVE-COLAB-PROXY-01` as the next bridge validation path.
2. Run the realtime notebook in a fresh Colab runtime.
3. Validate microphone mode first.
4. Validate browser tab/screen audio and record whether an audio track is available.
5. Validate display+mic mixing and note echo/double-audio behavior.
6. Validate virtual input/loopback route if such a device is available.
7. Collect a runtime report using `docs/realtime-colab.md`.
8. Only after runtime results are reviewed, decide whether Google Docs save belongs in a separate future scope.

Static/local validation can check notebook hygiene, URL helpers, error mapping and token response parsing. Live/browser/provider rows remain pending manual Colab runtime validation; do not claim E2E success until this checklist is completed.


### RUNTIME-01: source picker / manifest skip / docs output smoke-check

Цель: подтвердить основной Colab runtime flow на реальных Google Drive/Docs артефактах.

Checklist:

- [ ] Запустить `notebooks/elevenlabs_api_colab.ipynb` из `main` или конкретного commit SHA.
- [ ] Проверить Colab Secrets для нужного provider path без вывода значений.
- [ ] Выбрать source через Drive picker button path.
- [ ] Создать Google Docs transcript в выбранной папке результата.
- [ ] Проверить, что `manifest` обновил `sources` и `documents`.
- [ ] Повторить run с тем же source и подтвердить safe skip / `Пропустить` без повторного provider/STT call.
- [ ] Зафиксировать результат в `VALIDATION_MATRIX.md` только после фактической проверки.

Не заявлять E2E success до выполнения этого checklist.

### SPEAKER-RUNTIME-01: speaker projects workflow на копии diarized Google Doc

Цель: вручную проверить optional speaker project rename workflow в Colab/Google Docs.

Checklist:

- [ ] Создать копию diarized Google Doc с `Speaker N labels`.
- [ ] Открыть speaker project workflow только после выбора существующего Google Doc.
- [ ] Проверить gate behavior для metadata cases, если доступны тестовые документы: `Speakers: no`, `Speakers: yes`, unknown metadata.
- [ ] Убедиться, что labels detected только на turn-boundary lines.
- [ ] Проверить counts и sample phrases в UI.
- [ ] Создать или выбрать speaker project и active roster.
- [ ] Выполнить manual mapping `Speaker N → speaker`.
- [ ] Проверить preview counts и unmapped labels.
- [ ] Apply выполнить только на копии документа.
- [ ] Проверить, что изменились только speaker-turn labels, а unmapped labels остались как есть.
- [ ] Зафиксировать plain-text rewrite/formatting impact.

Не заявлять speaker workflow live E2E success до выполнения этого checklist.

### PERF-RUNTIME-01: startup timing summary

Цель: собрать реальный startup timing summary из Colab runtime.

Checklist:

- [ ] Запустить clean Colab runtime.
- [ ] Зафиксировать timing этапов launcher/dependency install/import/UI initialization.
- [ ] Проверить, что summary не содержит secrets, transcript body или Docs body content.
- [ ] Добавить результат в validation notes без заявления transcription success на основании одного timing summary.

## CI / локальная проверка для docs-only PR

Перед merge docs-only изменения должны пройти:

- [ ] `python scripts/ci_checks.py`
- [ ] `pytest -q`, если окружение позволяет полный запуск tests
- [ ] `git diff --check`

Если runtime code не менялся, это нужно явно указать в PR body. CI success для docs-only PR не заменяет runtime validation в Google Colab.

## Guardrails для следующих задач

- Не менять runtime code в docs-only задачах.
- Не менять tests без необходимости для docs-only checks.
- Не менять manifest schema без отдельного approved scope.
- Не менять notebook/runtime behavior в документационном cleanup.
- Не claim provider/STT/LLM или Google Docs E2E validation без фактической записи.
- Сохранять Russian-first user-facing wording и English identifiers только для technical names.
