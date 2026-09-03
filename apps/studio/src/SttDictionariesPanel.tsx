import { type FormEvent, useEffect, useState } from "react";
import { mutateWithCsrfRetry } from "./apiClient";
import {
  requestSttDictionaries,
  type SttDictionary,
  type SttDictionaryEntryKind,
} from "./sttContracts";

type Props = {
  csrf: string;
  onCsrf: (csrf: string) => void;
};

const KINDS = new Set<SttDictionaryEntryKind>([
  "term",
  "surname",
  "name",
  "abbreviation",
]);

function editorText(dictionary: SttDictionary) {
  return dictionary.entries
    .map((entry) => `${entry.kind}: ${entry.value}`)
    .join("\n");
}

function parseEntries(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      const kind = line.slice(0, separator).trim() as SttDictionaryEntryKind;
      const value = line.slice(separator + 1).trim();
      if (separator < 1 || !KINDS.has(kind) || !value) {
        throw new Error("invalid_dictionary_line");
      }
      return { kind, value };
    });
}

export function SttDictionariesPanel({ csrf, onCsrf }: Props) {
  const [dictionaries, setDictionaries] = useState<SttDictionary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState("");
  const [entries, setEntries] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    setState("loading");
    setMessage("");
    try {
      setDictionaries(await requestSttDictionaries());
      setState("ready");
    } catch {
      setState("error");
      setMessage("Не удалось загрузить пользовательские словари.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function closeEditor() {
    setEditorOpen(false);
    setEditorId(null);
    setName("");
    setEntries("");
  }

  function edit(dictionary: SttDictionary) {
    setEditorOpen(true);
    setEditorId(dictionary.id);
    setName(dictionary.name);
    setEntries(editorText(dictionary));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    let parsedEntries;
    try {
      parsedEntries = parseEntries(entries);
      if (!name.trim() || parsedEntries.length === 0) throw new Error("empty");
    } catch {
      setMessage(
        "Укажите название и хотя бы одну строку вида term: термин, surname: фамилия, name: имя или abbreviation: сокращение.",
      );
      return;
    }
    setPending(true);
    setMessage("");
    try {
      await mutateWithCsrfRetry(
        editorId ? `/stt/dictionaries/${editorId}` : "/stt/dictionaries",
        csrf,
        onCsrf,
        {
          method: editorId ? "PUT" : "POST",
          body: JSON.stringify({ name: name.trim(), entries: parsedEntries }),
        },
      );
      closeEditor();
      await load();
      setMessage("Словарь сохранён.");
    } catch {
      setMessage("Не удалось сохранить словарь. Проверьте название и записи.");
    } finally {
      setPending(false);
    }
  }

  async function remove(dictionary: SttDictionary) {
    if (pending || !window.confirm(`Удалить словарь «${dictionary.name}»?`)) return;
    setPending(true);
    setMessage("");
    try {
      await mutateWithCsrfRetry(
        `/stt/dictionaries/${dictionary.id}`,
        csrf,
        onCsrf,
        { method: "DELETE" },
      );
      if (editorId === dictionary.id) closeEditor();
      await load();
      setMessage("Словарь удалён.");
    } catch {
      setMessage("Не удалось удалить словарь.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card" aria-labelledby="stt-dictionaries-title">
      <h3 id="stt-dictionaries-title">Словари распознавания</h3>
      <p className="muted">
        Добавьте важные термины, фамилии, имена и сокращения. Совместимые режимы
        передадут выбранные словари провайдеру вместе с задачей.
      </p>
      {state === "loading" && <p role="status">Загружаем словари…</p>}
      {state === "error" && (
        <button type="button" onClick={() => void load()}>
          Повторить загрузку
        </button>
      )}
      {state === "ready" && dictionaries.length === 0 && !editorOpen && (
        <p className="muted">Словари пока не созданы.</p>
      )}
      {dictionaries.map((dictionary) => (
        <div className="split" key={dictionary.id}>
          <span>
            <b>{dictionary.name}</b> · {dictionary.entries.length} записей
          </span>
          <span className="actions">
            <button type="button" disabled={pending} onClick={() => edit(dictionary)}>
              Изменить
            </button>
            <button
              type="button"
              className="danger"
              disabled={pending}
              onClick={() => void remove(dictionary)}
            >
              Удалить
            </button>
          </span>
        </div>
      ))}
      {!editorOpen && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setEditorOpen(true);
            setEditorId(null);
            setName("Новый словарь");
            setEntries("");
            setMessage("");
          }}
        >
          Добавить словарь
        </button>
      )}
      {editorOpen && (
        <form className="stack" onSubmit={save}>
          <label>
            Название
            <input
              value={name}
              maxLength={120}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            Записи — по одной в строке
            <textarea
              value={entries}
              rows={6}
              disabled={pending}
              placeholder={"term: VoiceOps\nsurname: Иванов\nname: Алёна\nabbreviation: API"}
              onChange={(event) => setEntries(event.target.value)}
              required
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={pending}>
              {pending ? "Сохраняем…" : "Сохранить словарь"}
            </button>
            <button type="button" disabled={pending} onClick={closeEditor}>
              Отмена
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className={message.includes("сохранён") || message.includes("удалён") ? "notice" : "error"} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
