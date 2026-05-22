# Workflow транскрибации в Google Docs

Colab-based workflow для quality-first транскрибации длинных аудио- и видеофайлов в Google Docs.

## Что это за проект

Проект предназначен для транскрибации длинных русскоязычных лекций, вебинаров, созвонов и учебных записей с упором на:
- качество распознавания;
- устойчивость на длинных файлах;
- финальный результат сразу в Google Docs;
- защиту от повторной траты кредитов через manifest.

Это не просто API-обёртка, а целостный workflow:
- выбор источника;
- извлечение аудио из видео при необходимости;
- транскрибация через выбранного провайдера;
- постобработка и merge;
- запись результата в Google Docs;
- фиксация состояния в manifest.

## Провайдерная стратегия

- Основной провайдер: `ElevenLabs / scribe_v2`
- Fallback: `OpenAI / gpt-4o-transcribe`
- Speaker-aware сценарий: `OpenAI / gpt-4o-transcribe-diarize`

Важно:
- основной production-путь сейчас — ElevenLabs;
- OpenAI fallback добавлен архитектурно, но не все его ветки ещё подтверждены полными end-to-end прогонами;
- для OpenAI diarization + chunking есть известные ограничения.

## Поддерживаемые режимы источника

- computer: single file;
- computer: multiple files;
- Google Drive: single file;
- Google Drive: folder.

## Формат результата

Финальный результат сохраняется:
- только в Google Docs.

Локальные transcript-файлы и JSON-экспорты не считаются основным конечным артефактом.

## Секреты

Секреты не должны храниться в коде.

Для работы используются Google Colab Secrets / `userdata`:
- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY` — опционально, нужен только для OpenAI fallback
- другие Google-related credentials при необходимости

Пример доступа к секретам:

```python
from google.colab import userdata

ELEVENLABS_API_KEY = userdata.get("ELEVENLABS_API_KEY")
OPENAI_API_KEY = userdata.get("OPENAI_API_KEY")
```


## Статус Colab workflow и границы валидации

- **Google Colab остаётся основным и поддерживаемым способом запуска**.
- Текущий workflow используется в практике **более месяца без критических user-reported проблем**.
- Эта практическая стабильность **не равна формальной E2E-валидации каждого отдельного сценария**; для этого используется отдельная validation matrix.
- `ElevenLabs / scribe_v2` остаётся основным provider path.
- `OpenAI` сейчас используется как **manual fallback / alternative provider path**.
- **Automatic fallback не реализован**: для него нужен отдельный дизайн billing-safety, retry-политики и контроль повторных списаний.
- `OpenAI diarization` и особенно `OpenAI diarization + chunking` считаются **experimental / high risk** сценариями.
- Изменения для длинных ElevenLabs-файлов должны быть **консервативными и evidence-driven**; до введения client-side split нужны реальные E2E-валидации.
- Manifest сейчас рассчитан на **single-user / single-runtime Colab**; параллельные запуски из двух вкладок Colab официально не поддерживаются.
- Для provider HTTP ошибок используется **safe logging**: без печати raw response body в notebook output.
- Перед запуском транскрибации в Colab выводится **read-only preflight summary** (provider/model/API key presence/source mode/conflict/manifest/keyterms/risk notes) без вызовов STT API и без мутации manifest.
- На старте запуска выполняется **best-effort cleanup** устаревших временных файлов workflow в системной temp-директории:
  - только для артефактов с project-owned префиксом `elevenlabs_api_`;
  - только при возрасте старше TTL (по умолчанию 24 часа);
  - без удаления произвольных пользовательских `/tmp`-файлов и generic media.
- После каждого запуска в Colab выводится **локальная timing summary** по основным фазам (cleanup/context/source/provider/docs/manifest/per-file/run total) для диагностики узких мест без изменения provider/runtime поведения.

## Документация

Основной документ по проекту:
- `TECHNICAL_SPECIFICATION.md`

Именно там собраны:
- описание цели проекта;
- архитектура pipeline;
- runbook по использованию;
- модель работы с секретами;
- known limitations и текущие риск-зоны.

## Текущее состояние репозитория

Канонический кодовый артефакт уже присутствует в репозитории: `elevenlabs_api.py`.

Google Colab остаётся основным способом запуска workflow; файл `elevenlabs_api.py` используется как текущий source of truth для review и PR workflow.


## Запуск через Google Colab GitHub picker

Чтобы открыть workflow через **Google Colab → Open notebook → GitHub**, используйте launcher-ноутбук:
- `notebooks/elevenlabs_api_colab.ipynb`

Как это работает:
- launcher по умолчанию использует `GITHUB_REF = "main"`;
- подтягивает `requirements-colab.txt` и устанавливает зависимости в runtime Colab;
- подтягивает канонический `elevenlabs_api.py` из того же GitHub ref и запускает его в текущем runtime.

Если нужна фиксированная версия, замените `GITHUB_REF` на конкретный commit SHA в первой code-ячейке launcher-ноутбука.

## Lightweight GitHub Actions CI

Repository includes a lightweight GitHub Actions CI workflow for pull requests and pushes to `main`.

Scope:
- static repository hygiene checks only;
- notebook JSON and clean-output checks;
- launcher notebook thinness guard;
- conservative static guards for raw provider `resp.text` logging and broad `/tmp` cleanup patterns;
- optional `pytest` run when tests exist.

Non-goals:
- no real Colab transcription runs;
- no ElevenLabs/OpenAI/Google API calls;
- no provider or Google credentials required;
- no deployment/CD configuration.
