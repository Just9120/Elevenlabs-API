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

const selectionSummary = {
  google_document_count: 2,
  nested_folder_count: 3,
  skipped_non_document_count: 4,
  pages_scanned: 5,
  unreadable_document_count: 0,
};

const standardizationDryRun = {
  workflow: "standardization",
  operation: "dry_run",
  target_standard: "transcript_doc_v1.2",
  items: [
    {
      position: 0,
      name: "Лекция для обновления",
      standard_status: "outdated",
      action: "standardize_document",
      reason_code: null,
    },
    {
      position: 1,
      name: "Актуальная лекция",
      standard_status: "current",
      action: "unchanged",
      reason_code: null,
    },
  ],
  summary: {
    standardize_document_count: 1,
    unchanged_count: 1,
    blocked_count: 0,
  },
  selection_summary: selectionSummary,
};

const standardizationApply = {
  workflow: "standardization",
  operation: "apply",
  target_standard: "transcript_doc_v1.2",
  items: [
    {
      position: 0,
      name: "Лекция для обновления",
      action: "standardize_document",
      outcome: "standardized",
      reason_code: null,
    },
    {
      position: 1,
      name: "Актуальная лекция",
      action: "unchanged",
      outcome: "already_current",
      reason_code: null,
    },
  ],
  summary: {
    standardized_count: 1,
    already_current_count: 1,
    blocked_count: 0,
  },
  selection_summary: selectionSummary,
};

const catalogDryRun = {
  workflow: "catalog_import",
  operation: "dry_run",
  target_standard: "transcript_doc_v1.2",
  items: [
    {
      position: 0,
      name: "Лекция для каталога",
      standard_status: "current",
      import_status: "not_imported",
      settings_status: "indeterminate",
      action: "import_metadata",
      reason_code: null,
    },
    {
      position: 1,
      name: "Нестандартизированная лекция",
      standard_status: "outdated",
      import_status: "not_imported",
      settings_status: "indeterminate",
      action: "blocked",
      reason_code: "standardization_required",
    },
  ],
  summary: {
    import_metadata_count: 1,
    unchanged_count: 0,
    blocked_count: 1,
  },
  selection_summary: selectionSummary,
};

const catalogApply = {
  workflow: "catalog_import",
  operation: "apply",
  target_standard: "transcript_doc_v1.2",
  items: [
    {
      position: 0,
      name: "Лекция для каталога",
      action: "import_metadata",
      outcome: "imported",
      reason_code: null,
    },
    {
      position: 1,
      name: "Нестандартизированная лекция",
      action: "blocked",
      outcome: "blocked",
      reason_code: "standardization_required",
    },
  ],
  summary: {
    imported_count: 1,
    already_applied_count: 0,
    unchanged_count: 0,
    blocked_count: 1,
    standardization_required_count: 0,
    conflict_count: 0,
  },
  selection_summary: selectionSummary,
};

function renderPanel(pickerReady = true) {
  return render(
    <TranscriptCatalogMigrationPanel
      csrf="csrf-safe"
      onCsrf={vi.fn()}
      googleConnected={pickerReady}
      googleLoading={false}
      pickerReady={pickerReady}
    />,
  );
}

function sessionResponse() {
  return json({
    access_token: "private-access-token",
    api_key: "public-picker-key",
    app_id: "public-app-id",
    scope_ready: true,
  });
}

describe("TranscriptCatalogMigrationPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders two independent operations and keeps both disabled without Picker", () => {
    renderPanel(false);

    expect(
      screen.getByRole("heading", { name: "Две независимые операции" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Стандартизация Google Docs" }),
    ).toHaveTextContent("Каталог Studio и состояние заданий не изменяются");
    expect(
      screen.getByRole("region", { name: "Манифест Studio" }),
    ).toHaveTextContent("Google Docs не изменяются");
    expect(
      screen.getByText("Сначала подключите Google Drive выше."),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", {
      name: "Выбрать папку",
    })) {
      expect(button).toBeDisabled();
    }
    expect(
      screen.queryByRole("button", { name: "Выбрать документы" }),
    ).not.toBeInTheDocument();
  });

  it("runs separate recursive folder, dry-run, and apply flows", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/google/picker/session")) {
        return sessionResponse();
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/standardization/dry-run",
        )
      ) {
        return json(standardizationDryRun);
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/standardization/apply",
        )
      ) {
        return json(standardizationApply);
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/dry-run",
        )
      ) {
        return json(catalogDryRun);
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/apply",
        )
      ) {
        return json(catalogApply);
      }
      return json({}, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const picker = vi.spyOn(googlePicker, "openGooglePicker");
    picker
      .mockResolvedValueOnce({
        action: "picked",
        docs: [{ id: "private-standard-folder", name: "Архив стандартов" }],
      })
      .mockResolvedValueOnce({
        action: "picked",
        docs: [{ id: "private-catalog-folder", name: "Архив каталога" }],
      });

    renderPanel();
    const standardization = screen.getByRole("region", {
      name: "Стандартизация Google Docs",
    });
    const catalog = screen.getByRole("region", {
      name: "Манифест Studio",
    });

    await userEvent.click(
      within(standardization).getByRole("button", {
        name: "Выбрать папку",
      }),
    );
    expect(picker).toHaveBeenNthCalledWith(
      1,
      "transcript-folder",
      expect.objectContaining({ access_token: "private-access-token" }),
    );
    expect(standardization).toHaveTextContent(
      "Будут проверены Google Docs в ней и всех подпапках",
    );

    await userEvent.click(
      within(standardization).getByRole("button", {
        name: "Запустить dry-run",
      }),
    );
    const standardPreview = await within(standardization).findByLabelText(
      "Результат dry-run: Стандартизация Google Docs",
    );
    expect(standardPreview).toHaveTextContent("Лекция для обновления");
    expect(standardPreview).toHaveTextContent("Google Docs найдено");
    expect(standardPreview).toHaveTextContent("Вложенных папок: 3");
    expect(standardPreview).toHaveTextContent(
      "Пропущено других файлов: 4",
    );
    expect(standardPreview).not.toHaveTextContent(
      "Добавить метаданные в манифест",
    );

    await userEvent.click(
      within(standardization).getByRole("button", {
        name: "Подтвердить стандартизацию (1)",
      }),
    );
    expect(
      await within(standardization).findByRole("heading", {
        name: "Стандартизация завершена",
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(catalog).getByRole("button", { name: "Выбрать папку" }),
    );
    expect(picker).toHaveBeenNthCalledWith(
      2,
      "transcript-folder",
      expect.objectContaining({ access_token: "private-access-token" }),
    );
    await userEvent.click(
      within(catalog).getByRole("button", { name: "Запустить dry-run" }),
    );
    const catalogPreview = await within(catalog).findByLabelText(
      "Результат dry-run: Манифест Studio",
    );
    expect(catalogPreview).toHaveTextContent("Лекция для каталога");
    expect(catalogPreview).toHaveTextContent(
      "Сначала стандартизируйте документ",
    );
    expect(catalogPreview).not.toHaveTextContent(
      "Стандартизировать документ",
    );

    await userEvent.click(
      within(catalog).getByRole("button", {
        name: "Добавить в манифест Studio (1)",
      }),
    );
    expect(
      await within(catalog).findByRole("heading", {
        name: "Манифест Studio обновлён",
      }),
    ).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledTimes(2);

    const standardDryRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(
        "/api/transcript-maintenance/standardization/dry-run",
      ),
    );
    expect(standardDryRequest?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          folder_id: "private-standard-folder",
        }),
        headers: expect.objectContaining({
          "x-csrf-token": "csrf-safe",
        }),
      }),
    );
    const catalogApplyRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(
        "/api/transcript-maintenance/catalog-import/apply",
      ),
    );
    expect(catalogApplyRequest?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          folder_id: "private-catalog-folder",
          confirm_apply: true,
        }),
      }),
    );
    for (const privateValue of [
      "private-access-token",
      "private-standard-folder",
      "private-catalog-folder",
    ]) {
      expect(document.body).not.toHaveTextContent(privateValue);
    }
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("clears the preview after selection changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/google/picker/session")) {
          return sessionResponse();
        }
        return json(standardizationDryRun);
      }),
    );
    vi.spyOn(googlePicker, "openGooglePicker")
      .mockResolvedValueOnce({
        action: "picked",
        docs: [{ id: "private-folder", name: "Архив" }],
      })
      .mockResolvedValueOnce({
        action: "picked",
        docs: [{ id: "private-other-folder", name: "Другой архив" }],
      });
    renderPanel();
    const region = screen.getByRole("region", {
      name: "Стандартизация Google Docs",
    });

    await userEvent.click(
      within(region).getByRole("button", { name: "Выбрать папку" }),
    );
    await userEvent.click(
      within(region).getByRole("button", { name: "Запустить dry-run" }),
    );
    await within(region).findByLabelText(
      "Результат dry-run: Стандартизация Google Docs",
    );

    await userEvent.click(
      within(region).getByRole("button", { name: "Сменить папку" }),
    );

    expect(
      within(region).queryByLabelText(
        "Результат dry-run: Стандартизация Google Docs",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(region).queryByRole("button", {
        name: "Подтвердить стандартизацию (1)",
      }),
    ).not.toBeInTheDocument();
    expect(region).toHaveTextContent("Корневая папка: Другой архив");
  });

  it("requires a fresh dry-run after a safe apply failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/google/picker/session")) {
          return sessionResponse();
        }
        if (url.endsWith("/dry-run")) {
          return json(standardizationDryRun);
        }
        return json(
          {
            detail: {
              reason: "catalog_document_revision_changed",
              retryable: true,
              raw_google_error: "private raw response",
            },
          },
          false,
          409,
        );
      }),
    );
    vi.spyOn(googlePicker, "openGooglePicker")
      .mockResolvedValueOnce({
        action: "picked",
        docs: [{ id: "private-folder", name: "Изменяемый архив" }],
      });
    renderPanel();
    const region = screen.getByRole("region", {
      name: "Стандартизация Google Docs",
    });

    await userEvent.click(
      within(region).getByRole("button", { name: "Выбрать папку" }),
    );
    await userEvent.click(
      within(region).getByRole("button", { name: "Запустить dry-run" }),
    );
    await within(region).findByLabelText(
      "Результат dry-run: Стандартизация Google Docs",
    );
    await userEvent.click(
      within(region).getByRole("button", {
        name: "Подтвердить стандартизацию (1)",
      }),
    );

    expect(
      await within(region).findByText(
        "Документ изменился после проверки. Запустите dry-run заново.",
      ),
    ).toBeInTheDocument();
    expect(region).not.toHaveTextContent("private raw response");
    expect(
      within(region).queryByRole("button", {
        name: "Подтвердить стандартизацию (1)",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: "Запустить dry-run" }),
    ).toBeEnabled();
  });
});
