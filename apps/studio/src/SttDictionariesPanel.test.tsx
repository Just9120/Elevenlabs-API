import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SttDictionariesPanel } from "./SttDictionariesPanel";
import type { SttDictionary } from "./sttContracts";

const response = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  } as Response);

describe("SttDictionariesPanel", () => {
  beforeEach(() => {
    let dictionaries: SttDictionary[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/api/stt/dictionaries") && !init?.method) {
          return response({ dictionaries });
        }
        if (url.endsWith("/api/stt/dictionaries") && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          dictionaries = [
            {
              id: "dictionary-safe",
              name: body.name,
              active: true,
              entries: body.entries,
              updated_at: "2026-09-03T12:00:00Z",
            },
          ];
          return response(dictionaries[0]);
        }
        if (
          url.endsWith("/api/stt/dictionaries/dictionary-safe") &&
          init?.method === "PUT"
        ) {
          const body = JSON.parse(String(init.body));
          dictionaries = [
            {
              ...dictionaries[0],
              name: body.name,
              entries: body.entries,
              updated_at: "2026-09-03T12:01:00Z",
            },
          ];
          return response(dictionaries[0]);
        }
        if (
          url.endsWith("/api/stt/dictionaries/dictionary-safe") &&
          init?.method === "DELETE"
        ) {
          dictionaries = [];
          return response({ ok: true });
        }
        return response({ ok: true });
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates all supported owner dictionary entry kinds", async () => {
    const user = userEvent.setup();
    render(
      <SttDictionariesPanel csrf="csrf-safe" onCsrf={vi.fn()} />,
    );

    expect(await screen.findByText("Словари пока не созданы.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Добавить словарь" }));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Проектный словарь");
    await user.type(
      screen.getByLabelText("Записи — по одной в строке"),
      "term: VoiceOps\nsurname: Иванов\nname: Алёна\nabbreviation: API",
    );
    await user.click(screen.getByRole("button", { name: "Сохранить словарь" }));

    expect(await screen.findByText("Словарь сохранён.")).toBeInTheDocument();
    expect(screen.getByText("Проектный словарь").closest("span")).toHaveTextContent(
      "Проектный словарь · 4 записей",
    );
    const createCall = vi.mocked(fetch).mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/stt/dictionaries") &&
        init?.method === "POST",
    );
    expect(createCall?.[1]).toMatchObject({
      credentials: "same-origin",
      headers: expect.objectContaining({ "x-csrf-token": "csrf-safe" }),
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      name: "Проектный словарь",
      entries: [
        { kind: "term", value: "VoiceOps" },
        { kind: "surname", value: "Иванов" },
        { kind: "name", value: "Алёна" },
        { kind: "abbreviation", value: "API" },
      ],
    });
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.filter(
          ([url, init]) =>
            String(url).endsWith("/api/stt/dictionaries") && !init?.method,
        ),
      ).toHaveLength(2),
    );

    await user.click(screen.getByRole("button", { name: "Изменить" }));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Обновлённый словарь");
    await user.click(screen.getByRole("button", { name: "Сохранить словарь" }));
    expect(await screen.findByText(/Обновлённый словарь/)).toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/stt/dictionaries/dictionary-safe") &&
          init?.method === "PUT",
      ),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(await screen.findByText("Словари пока не созданы.")).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith(
      "Удалить словарь «Обновлённый словарь»?",
    );
    expect(
      vi.mocked(fetch).mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/stt/dictionaries/dictionary-safe") &&
          init?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("rejects unknown entry syntax before any mutation", async () => {
    const user = userEvent.setup();
    render(
      <SttDictionariesPanel csrf="csrf-safe" onCsrf={vi.fn()} />,
    );

    await screen.findByText("Словари пока не созданы.");
    await user.click(screen.getByRole("button", { name: "Добавить словарь" }));
    await user.type(
      screen.getByLabelText("Записи — по одной в строке"),
      "secret: raw-provider-value",
    );
    await user.click(screen.getByRole("button", { name: "Сохранить словарь" }));

    expect(
      screen.getByText(/Укажите название и хотя бы одну строку вида/),
    ).toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });
});
