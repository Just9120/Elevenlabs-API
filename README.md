# Workflow транскрибации в Google Docs

Colab-based workflow для транскрибации длинных аудио- и видеофайлов в Google Docs.

## Что делает проект

Этот проект предназначен для quality-first транскрибации длинных русскоязычных лекций, вебинаров, созвонов и учебных записей.

Основной сценарий работы:
- выбор источника из локальной загрузки или Google Drive;
- извлечение аудио из видео при необходимости;
- транскрибация через ElevenLabs как основной провайдер;
- fallback через OpenAI при необходимости;
- сохранение результата напрямую в Google Docs;
- защита от повторной траты кредитов через manifest;
- импорт уже существующих транскриптов в manifest без повторной транскрибации.

## Основная стратегия провайдеров

- Основной провайдер: `ElevenLabs / scribe_v2`
- Fallback: `OpenAI / gpt-4o-transcribe`
- Для созвонов с разделением по спикерам: `OpenAI / gpt-4o-transcribe-diarize`

## Текущий статус

Текущая основная кандидатная версия основана на workflow с:
- выбором провайдера;
- режимами языка `Русский / Автоопределение`;
- опцией разделения по спикерам;
- smart split для ограничений OpenAI по размеру файла;
- overlap-aware merge;
- silence-aware split;
- защитой от падения при отсутствии `OPENAI_API_KEY`, если OpenAI не выбран.

Важно:
- основной production-путь сейчас — ElevenLabs;
- OpenAI fallback добавлен архитектурно, но не все ветки ещё подтверждены полными реальными end-to-end прогонами;
- для OpenAI diarization + chunking есть известные ограничения.

## Основные возможности

- работа из Google Colab;
- поддержка Google Drive как источника;
- сохранение результата только в Google Docs;
- выбор output folder;
- несколько source modes;
- conflict modes;
- chunked insert в Google Docs;
- manifest со статусами обработки;
- import existing / backfill;
- поддержка keyterms;
- optional speaker split.

## Поддерживаемые режимы источника

Поддерживаются 4 режима:
- компьютер: один файл;
- компьютер: несколько файлов;
- Google Drive: один файл;
- Google Drive: папка.

## Формат результата

Итоговый результат сохраняется:
- только в Google Docs.

Не используется как финальный результат:
- локальные transcript-файлы;
- JSON-экспорты транскриптов.

## Секреты

Секреты не должны храниться в коде.

Для работы используются Google Colab Secrets / userdata:
- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY` — опционально, нужен только для OpenAI fallback
- другие Google-related credentials при необходимости

Пример получения секретов:

```python
from google.colab import userdata

ELEVENLABS_API_KEY = userdata.get("ELEVENLABS_API_KEY")
OPENAI_API_KEY = userdata.get("OPENAI_API_KEY")
