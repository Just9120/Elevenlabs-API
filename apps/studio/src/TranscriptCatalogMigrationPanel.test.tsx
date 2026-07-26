import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as googlePicker from "./googlePicker";
import { TranscriptCatalogMigrationPanel } from "./TranscriptCatalogMigrationPanel";

const json = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  } as Response);

const scanSummary = {
  google_document_count: 2,
  nested_folder_count: 1,
  skipped_non_document_count: 3,
  unreadable_document_count: 0,
  pages_scanned: 1,
};

const dryRunPayload = {
  operation: "dry_run",
  target_standard: "transcript_doc_v1.2",
  items: [
    {
      position: 0,
      name: "Лекция 1",
      standard_status: "outdated",
      import_status: "not_imported",
      settings_status: "indeterminate",
      action: "standardize_and_import",
      reason_code: null,
    },
    {
      position: 1,
      name: "Лекция с конфликтом",
      standard_status: "current",
      import_status: "conflict",
      settings_status: "exact",
      action: "blocked",
      reason_code: "catalog_conflict",
    },
  ],
  summary: {
    import_metadata_count: 0,
    standardize_and_import_count: 1,
    standardize_document_count: 0,
    unchanged_count: 0,
    blocked_count: 1,
  },
  scan_summary: scanSummary,
};

const applyPayload = {
  operation: "apply",
  target_standard: "transcript_doc_v1.2",
  items: [
    {
      position: 0,
      name: "Лекция 1",
      action: "standardize_and_import",
      outcome: "imported",
      reason_code: null,
      standardization_outcome: "changed",
    },
    {
      position: 1,
      name: "Лекция с конфликтом",
      action: "blocked",
      outcome: "blocked",
      reason_code: "catalog_conflict",
      standardization_outcome: "not_required",
    },
  ],
  summary: {
    imported_count: 1,
    already_applied_count: 0,
    unchanged_count: 0,
    blocked_count: 1,
    standardization_required_count: 0,
    conflict_count: 0,
    document_standardized_count: 1,
    document_already_current_count: 0,
    document_standardization_blocked_count: 0,
  },
  scan_summary: scanSummary,
};

describe("TranscriptCatalogMigrationPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("runs a safe dry-run and a separately confirmed fresh apply", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/google/picker/session")) {
        return json({
          access_token: "private-access-token",
          api_key: "public-picker-key",
          app_id: "public-app-id",
          scope_ready: true,
        });
      }
      if (url.endsWith("/api/transcript-catalog/migration/dry-run")) {
        return json(dryRunPayload);
      }
      if (url.endsWith("/api/transcript-catalog/migration/apply")) {
        return json(applyPayload);
      }
      return json({ init }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const picker = vi.spyOn(googlePicker, "openGooglePicker");
    picker.mockResolvedValue({
      action: "picked",
      docs: [{ id: "private-folder-id", name: "Архив транскриптов" }],
    });

    render(
      <TranscriptCatalogMigrationPanel
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        googleConnected
        googleLoading={false}
        pickerReady
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать папку каталога" }),
    );
    expect(picker).toHaveBeenCalledWith(
      "catalog-folder",
      expect.objectContaining({ access_token: "private-access-token" }),
    );
    expect(screen.getByText("Архив транскриптов")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Запустить dry-run" }),
    );
    const preview = await screen.findByLabelText("Результат dry-run");
    expect(
      within(preview).getByRole("heading", { name: "План миграции" }),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Лекция 1")).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Требуется отдельное разрешение конфликта",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/сервер заново просканирует папку/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Вложенные папки обнаружены, но не обходятся/),
    ).toBeInTheDocument();

    const dryRunRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/transcript-catalog/migration/dry-run"),
    );
    expect(dryRunRequest?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ folder_id: "private-folder-id" }),
        headers: expect.objectContaining({
          "x-csrf-token": "csrf-safe",
        }),
      }),
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Подтвердить и применить (1)",
      }),
    );
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("heading", { name: "Миграция завершена" }),
    ).toBeInTheDocument();

    const applyRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/transcript-catalog/migration/apply"),
    );
    expect(applyRequest?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          folder_id: "private-folder-id",
          confirm_apply: true,
        }),
        headers: expect.objectContaining({
          "x-csrf-token": "csrf-safe",
        }),
      }),
    );
    expect(screen.queryByText("private-folder-id")).not.toBeInTheDocument();
    expect(
      screen.queryByText("private-access-token"),
    ).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("stays disabled without Picker authority and normalizes API errors", async () => {
    const { rerender } = render(
      <TranscriptCatalogMigrationPanel
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        googleConnected={false}
        googleLoading={false}
        pickerReady={false}
      />,
    );
    expect(
      screen.getByText("Сначала подключите Google Drive выше."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Выбрать папку каталога" }),
    ).toBeDisabled();

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/google/picker/session")) {
        return json({
          access_token: "private-access-token",
          api_key: "public-picker-key",
          app_id: "public-app-id",
          scope_ready: true,
        });
      }
      return json(
        {
          detail: {
            reason: "catalog_folder_unavailable",
            retryable: false,
            raw_google_error: "private raw response",
          },
        },
        false,
        422,
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({
      action: "picked",
      docs: [{ id: "private-folder-id", name: "Недоступный архив" }],
    });
    rerender(
      <TranscriptCatalogMigrationPanel
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        googleConnected
        googleLoading={false}
        pickerReady
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать папку каталога" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Запустить dry-run" }),
    );

    expect(
      await screen.findByText(
        "Выбранная папка недоступна приложению. Выберите её через Google Picker ещё раз.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("private raw response")).not.toBeInTheDocument();
    expect(screen.queryByText("private-folder-id")).not.toBeInTheDocument();

    rerender(
      <TranscriptCatalogMigrationPanel
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        googleConnected={false}
        googleLoading={false}
        pickerReady={false}
      />,
    );
    expect(screen.queryByText("Недоступный архив")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Запустить dry-run" }),
    ).toBeDisabled();
  });

  it("requires a new dry-run after any failed apply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/google/picker/session")) {
          return json({
            access_token: "private-access-token",
            api_key: "public-picker-key",
            app_id: "public-app-id",
            scope_ready: true,
          });
        }
        if (url.endsWith("/api/transcript-catalog/migration/dry-run")) {
          return json(dryRunPayload);
        }
        return json(
          {
            detail: {
              reason: "catalog_document_revision_changed",
              retryable: true,
            },
          },
          false,
          409,
        );
      }),
    );
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({
      action: "picked",
      docs: [{ id: "private-folder-id", name: "Изменяемый архив" }],
    });
    render(
      <TranscriptCatalogMigrationPanel
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        googleConnected
        googleLoading={false}
        pickerReady
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Выбрать папку каталога" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Запустить dry-run" }),
    );
    await screen.findByLabelText("Результат dry-run");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Подтвердить и применить (1)",
      }),
    );

    expect(
      await screen.findByText(
        "Документ изменился после проверки. Запустите dry-run заново.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Подтвердить и применить (1)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Запустить dry-run" }),
    ).toBeEnabled();
  });
});
