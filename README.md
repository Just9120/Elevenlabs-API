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

## Документация

Основной документ по проекту:
- `TECHNICAL_SPECIFICATION.md`

Именно там собраны:
- описание цели проекта;
- архитектура pipeline;
- runbook по использованию;
- модель работы с секретами;
- known limitations и текущие риск-зоны.

## Ближайший зрелый шаг

Следующий важный шаг для репозитория — добавить канонический `.py` файл как основной кодовый артефакт для review и PR workflow. `.ipynb` при необходимости можно держать как Colab shell, но не как единственный source of truth.
