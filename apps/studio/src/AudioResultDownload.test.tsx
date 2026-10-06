import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioResultDownload } from "./AudioResultDownload";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

describe("transient audio download", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("shows preparation/progress before offering the streamed download", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input).endsWith("/status")) return json({ state: "ready", percent: 100 });
      expect(options?.method).toBe("POST");
      return json({ state: "preparing", percent: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AudioResultDownload jobId="audio" csrf="csrf" onCsrf={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Подготовить файл для скачивания" })); });
    expect(screen.getByRole("button", { name: "Готовим скачивание…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Собираем файл из исходников");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole("link", { name: "Скачать файл" })).toHaveAttribute("href", "/api/audio-preparations/audio/download");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from an expired preparation without exposing internal errors", async () => {
    vi.useFakeTimers();
    let requests = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/status")) return json({ detail: { reason: "download_expired" } }, 409);
      requests += 1;
      return json({ state: requests > 1 ? "ready" : "preparing", percent: requests > 1 ? 100 : 0 });
    }));
    render(<AudioResultDownload jobId="audio" csrf="csrf" onCsrf={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Подготовить файл для скачивания" })); });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole("alert")).toHaveTextContent("Временный файл уже очищен");
    expect(screen.queryByText("download_expired")).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Подготовить файл для скачивания" })); });
    expect(screen.getByRole("link", { name: "Скачать файл" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("allows cancellation and waits for its confirmed outcome", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/cancel")) return json({ status: "completed" });
      if (String(input).endsWith("/status")) return json({ state: "failed", percent: 0, reason: "cancellation_requested" });
      return json({ state: "preparing", percent: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AudioResultDownload jobId="audio" csrf="csrf" onCsrf={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Подготовить файл для скачивания" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Отменить скачивание" })); });
    expect(screen.getByRole("status")).toHaveTextContent("Отменяем подготовку");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole("alert")).toHaveTextContent("Подготовка скачивания отменена");
    expect(screen.getByRole("button", { name: "Подготовить файл для скачивания" })).toBeEnabled();
  });

  it("restores a pending download and closes a ready artifact to release other actions", async () => {
    vi.useFakeTimers();
    const onActiveChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/cancel")) return json({ state: "failed", percent: 0, reason: "cancellation_requested" });
      return json({ state: "ready", percent: 100 });
    }));
    render(<AudioResultDownload jobId="audio" csrf="csrf" onCsrf={vi.fn()} initialActive onActiveChange={onActiveChange} />);
    expect(screen.getByRole("button", { name: "Готовим скачивание…" })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole("link", { name: "Скачать файл" })).toBeVisible();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Закрыть скачивание" })); });
    expect(onActiveChange.mock.calls).toEqual([["audio", true], ["audio", false]]);
    expect(screen.getByRole("button", { name: "Подготовить файл для скачивания" })).toBeEnabled();
  });

  it("explicitly prepares a bounded listening sample before full processing", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/audio-preparations/audio/preview-audio");
      return json({ state: "ready", percent: 100 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AudioResultDownload jobId="audio" csrf="csrf" onCsrf={vi.fn()} preview />);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Прослушать пример обработки" })); });
    expect(screen.getByLabelText("Прослушать пример обработки")).toHaveAttribute("preload", "none");
    expect(screen.getByText(/Фрагмент до 30 секунд/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Скачать файл" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Закрыть пример" })).toBeEnabled();
  });
});
