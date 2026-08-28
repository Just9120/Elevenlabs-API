import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSessionsPanel } from "./AccountSessionsPanel";


const current = {
  id: "00000000-0000-0000-0000-000000000001",
  is_current: true,
  created_at: "2026-08-27T10:00:00+00:00",
  last_seen_at: "2026-08-27T10:05:00+00:00",
  expires_at: "2026-09-10T10:00:00+00:00",
};
const other = {
  ...current,
  id: "00000000-0000-0000-0000-000000000002",
  is_current: false,
  created_at: "2026-08-26T09:00:00+00:00",
};
const third = {
  ...other,
  id: "00000000-0000-0000-0000-000000000003",
};

function collection(sessions = [current, other], truncated = false) {
  return { sessions, truncated, limit: 100 };
}

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AccountSessionsPanel", () => {
  it("renders safe session state and revokes one selected other session", async () => {
    let revoked = false;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        revoked = true;
        return json({ revoked: true, active: false });
      }
      return json(revoked ? collection([current]) : collection());
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AccountSessionsPanel csrf="csrf-safe" onCsrf={vi.fn()} />);

    const region = await screen.findByRole("region", {
      name: "Активные сессии",
    });
    expect(within(region).getByText("Текущая сессия")).toBeInTheDocument();
    expect(within(region).getByText("Другая сессия")).toBeInTheDocument();
    expect(region).not.toHaveTextContent(current.id);
    await userEvent.click(
      within(region).getByRole("button", { name: "Завершить сессию" }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      "Завершить выбранную сессию на другом устройстве?",
    );
    expect(
      await within(region).findByText("Сессия завершена."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(region).queryByText("Другая сессия")).not.toBeInTheDocument(),
    );
    const deleteCall = fetchMock.mock.calls.find(
      ([, options]) => options?.method === "DELETE",
    );
    expect(deleteCall?.[0]).toBe(`/api/auth/sessions/${other.id}`);
    expect(new Headers(deleteCall?.[1]?.headers).get("x-csrf-token")).toBe(
      "csrf-safe",
    );
  });

  it("reconciles an ambiguous targeted mutation exactly once", async () => {
    let reads = 0;
    let deletes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          deletes += 1;
          return Promise.reject(new TypeError("raw network failure"));
        }
        reads += 1;
        return json(reads === 1 ? collection() : collection([current]));
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AccountSessionsPanel csrf="csrf" onCsrf={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Завершить сессию" }),
    );
    expect(
      await screen.findByText(
        "Завершение сессии подтверждено по актуальному списку.",
      ),
    ).toBeInTheDocument();
    expect(deletes).toBe(1);
    expect(reads).toBe(2);
  });

  it("revokes all other sessions and preserves the current session", async () => {
    let revoked = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          revoked = true;
          return json({ revoked: 2 });
        }
        return json(revoked ? collection([current]) : collection([current, other, third]));
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AccountSessionsPanel csrf="csrf" onCsrf={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Завершить все остальные" }),
    );
    expect(window.confirm).toHaveBeenCalledWith(
      "Завершить все остальные активные сессии?",
    );
    expect(
      await screen.findByText("Все остальные сессии завершены."),
    ).toBeInTheDocument();
    expect(screen.getByText("Текущая сессия")).toBeInTheDocument();
    expect(screen.getByText("Других активных сессий нет.")).toBeInTheDocument();
  });

  it("preserves the last confirmed list when refresh fails", async () => {
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        reads += 1;
        return reads === 1
          ? json(collection())
          : Promise.reject(new TypeError("raw read failure"));
      }),
    );
    render(<AccountSessionsPanel csrf="csrf" onCsrf={vi.fn()} />);
    expect(await screen.findByText("Другая сессия")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Обновить" }));
    expect(
      await screen.findByText(
        "Не удалось обновить активные сессии. Последний подтверждённый список сохранён.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Другая сессия")).toBeInTheDocument();
    expect(screen.queryByText("raw read failure")).not.toBeInTheDocument();
  });
});
