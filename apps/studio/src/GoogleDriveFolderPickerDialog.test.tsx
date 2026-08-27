import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openGooglePicker, resetGooglePickerLoaderForTests } from "./googlePicker";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Google Drive output-folder picker", () => {
  beforeEach(() => {
    resetGooglePickerLoaderForTests();
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(init?.headers).toEqual({
          Authorization: "Bearer ya29.test-folder-token",
        });
        if (url.pathname.endsWith("/files/root")) {
          return Promise.resolve(
            json({
              id: "root-id",
              name: "Мой диск",
              mimeType: "application/vnd.google-apps.folder",
            }),
          );
        }
        if (url.pathname.endsWith("/drives")) {
          return Promise.resolve(json({ drives: [] }));
        }
        const query = url.searchParams.get("q") ?? "";
        if (query.includes("sharedWithMe")) {
          return Promise.resolve(json({ files: [] }));
        }
        if (query.includes("'root-id' in parents")) {
          return Promise.resolve(
            json({
              files: [
                {
                  id: "empty-folder-id",
                  name: "Пустая папка",
                  mimeType: "application/vnd.google-apps.folder",
                },
              ],
            }),
          );
        }
        if (query.includes("'empty-folder-id' in parents")) {
          return Promise.resolve(json({ files: [] }));
        }
        return Promise.resolve(json({}, 404));
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    document
      .querySelectorAll('[data-studio-google-drive-folder-picker="true"]')
      .forEach((node) => node.remove());
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps current empty folder selectable and returns its exact ID", async () => {
    const session = {
      access_token: "ya29.test-folder-token",
      api_key: "public",
      app_id: "app",
      scope_ready: true,
    };
    let resultPromise!: ReturnType<typeof openGooglePicker>;
    await act(async () => {
      resultPromise = openGooglePicker("output-folder", session);
      await Promise.resolve();
    });

    expect(session.access_token).toBe("");
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      await screen.findByRole("dialog", {
        name: "Выберите папку для результатов",
      }),
    ).toHaveAttribute("aria-modal", "true");

    const selectCurrent = screen.getByRole("button", {
      name: "Выбрать эту папку",
    });
    await waitFor(() => expect(selectCurrent).toBeEnabled());
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Открыть папку «Пустая папка»",
      }),
    );

    expect(
      await screen.findByText(
        "Внутри нет папок. Текущую папку можно выбрать.",
      ),
    ).toBeInTheDocument();
    expect(selectCurrent).toBeEnabled();
    expect(screen.getByText("Текущая папка: Пустая папка")).toBeInTheDocument();
    await userEvent.click(selectCurrent);

    await expect(resultPromise).resolves.toEqual({
      action: "picked",
      docs: [
        {
          id: "empty-folder-id",
          name: "Пустая папка",
          mimeType: "application/vnd.google-apps.folder",
        },
      ],
    });
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.body.textContent).not.toContain("ya29.test-folder-token");
  });

  it("restores scroll lock when the user cancels", async () => {
    let resultPromise!: ReturnType<typeof openGooglePicker>;
    await act(async () => {
      resultPromise = openGooglePicker("output-folder", {
        access_token: "ya29.test-folder-token",
        api_key: "public",
        app_id: "app",
        scope_ready: true,
      });
      await Promise.resolve();
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Закрыть выбор папки" }),
    );
    await expect(resultPromise).resolves.toEqual({ action: "cancel" });
    expect(document.body.style.overflow).toBe("");
  });

  it("returns a safe error and restores scroll when Drive rejects the root request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({}, 401))));
    let resultPromise!: ReturnType<typeof openGooglePicker>;
    await act(async () => {
      resultPromise = openGooglePicker("output-folder", {
        access_token: "ya29.test-folder-token",
        api_key: "public",
        app_id: "app",
        scope_ready: true,
      });
      await Promise.resolve();
    });

    await expect(resultPromise).resolves.toEqual({
      action: "error",
      message:
        "Не удалось загрузить папки Google Drive. Переподключите Drive или повторите попытку.",
    });
    expect(document.body.style.overflow).toBe("");
    expect(
      document.querySelector('[data-studio-google-drive-folder-picker="true"]'),
    ).toBeNull();
  });

  it("times out safely and restores scroll when Drive never responds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    let resultPromise!: ReturnType<typeof openGooglePicker>;
    act(() => {
      resultPromise = openGooglePicker("output-folder", {
        access_token: "ya29.test-folder-token",
        api_key: "public",
        app_id: "app",
        scope_ready: true,
      });
    });
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    await expect(resultPromise).resolves.toEqual({
      action: "error",
      message: "Время выбора папки Google Drive истекло. Повторите попытку.",
    });
    expect(document.body.style.overflow).toBe("");
  });
});
