import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as googlePicker from "./googlePicker";
import {
  maintenanceAccessStatus,
  TranscriptCatalogMigrationPanel,
} from "./TranscriptCatalogMigrationPanel";

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
const readyMaintenanceConnection = {
  connected: true,
  status: "active",
  google_email: "safe.user@example.com",
  scopes:
    "openid email https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/documents",
  connected_at: "2026-07-28T00:00:00Z",
  revoked_at: null,
  configured: true,
  account_match: true,
  scope_ready: true,
  ready: true,
  reconnect_required: false,
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
      source_creation_status: "authoritative",
      action: "standardize_document",
      reason_code: null,
    },
    {
      position: 1,
      name: "Актуальная лекция",
      standard_status: "current",
      source_creation_status: "authoritative",
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
      source_creation_status: "authoritative",
      action: "standardize_document",
      outcome: "standardized",
      reason_code: null,
    },
    {
      position: 1,
      name: "Актуальная лекция",
      source_creation_status: "authoritative",
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

const singleSelectionSummary = {
  google_document_count: 1,
  nested_folder_count: 0,
  skipped_non_document_count: 0,
  pages_scanned: 0,
  unreadable_document_count: 0,
};
const singleStandardizationDryRun = {
  ...standardizationDryRun,
  items: [standardizationDryRun.items[0]],
  summary: {
    standardize_document_count: 1,
    unchanged_count: 0,
    blocked_count: 0,
  },
  selection_summary: singleSelectionSummary,
};
const singleCatalogDryRun = {
  ...catalogDryRun,
  items: [catalogDryRun.items[0]],
  summary: {
    import_metadata_count: 1,
    unchanged_count: 0,
    blocked_count: 0,
  },
  selection_summary: singleSelectionSummary,
};
const singleCatalogApply = {
  ...catalogApply,
  items: [catalogApply.items[0]],
  summary: {
    imported_count: 1,
    already_applied_count: 0,
    unchanged_count: 0,
    blocked_count: 0,
    standardization_required_count: 0,
    conflict_count: 0,
  },
  selection_summary: singleSelectionSummary,
};

function renderPanel(pickerReady = true) {
  return render(
    <TranscriptCatalogMigrationPanel
      csrf="csrf-safe"
      onCsrf={vi.fn()}
      googleConnected={pickerReady}
      googleLoading={false}
      pickerReady={pickerReady}
      maintenanceOauthResult={null}
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

describe("maintenanceAccessStatus", () => {
  const base = {
    googleConnected: true,
    googleLoading: false,
    pickerReady: true,
    maintenanceConnection: readyMaintenanceConnection,
    maintenanceLoading: false,
    maintenanceReadError: "",
  };

  it.each([
    [
      "server_not_configured",
      { maintenanceConnection: { ...readyMaintenanceConnection, configured: false, ready: false } },
    ],
    [
      "maintenance_revoked",
      { maintenanceConnection: { ...readyMaintenanceConnection, status: "revoked", ready: false } },
    ],
    [
      "account_mismatch",
      { maintenanceConnection: { ...readyMaintenanceConnection, account_match: false, ready: false } },
    ],
    [
      "scope_missing",
      { maintenanceConnection: { ...readyMaintenanceConnection, scope_ready: false, ready: false } },
    ],
    ["ready", {}],
  ])("classifies %s without exposing raw provider state", (kind, overrides) => {
    expect(maintenanceAccessStatus({ ...base, ...overrides })).toMatchObject({
      kind,
    });
  });
});

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
      screen.getByText(
        "Блокер: основное подключение Google Drive отсутствует.",
      ),
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

  it("clears the manifest only after an explicit Да confirmation", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/google/maintenance/connection")) {
        return json(readyMaintenanceConnection);
      }
      if (url.endsWith("/api/transcript-catalog/clear")) {
        return json({
          ok: true,
          reset_at: "2026-08-21T12:00:00Z",
          hidden_evidence_count: 7,
        });
      }
      return json({}, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    await screen.findByText(/Расширенный доступ подключён/);

    await userEvent.click(
      screen.getByRole("button", { name: "Очистить манифест" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Нет" }));
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/api/transcript-catalog/clear"),
      ),
    ).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Очистить манифест" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Да" }));
    expect(
      await screen.findByText(
        "Манифест очищен. Результаты, Google Docs и исходные файлы сохранены.",
      ),
    ).toBeInTheDocument();
    const clearCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/transcript-catalog/clear"),
    );
    expect(clearCalls).toHaveLength(1);
    expect(clearCalls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirm_clear: true }),
      }),
    );
  });

  it("runs separate recursive folder, dry-run, and apply flows", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/google/maintenance/connection")) {
        return json(readyMaintenanceConnection);
      }
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
    expect(
      await screen.findByText(/Расширенный доступ подключён/),
    ).toBeInTheDocument();
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
    expect(catalog).toHaveTextContent(
      "Результат сохранён в каталоге Studio",
    );
    expect(
      within(catalog).queryByRole("button", {
        name: /Добавить в манифест Studio/,
      }),
    ).not.toBeInTheDocument();
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
          selection_mode: "folder_tree",
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
          selection_mode: "folder_tree",
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

  it("supports an independent single-document mode for each operation", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/google/maintenance/connection")) {
        return json(readyMaintenanceConnection);
      }
      if (url.endsWith("/api/google/picker/session")) {
        return sessionResponse();
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/standardization/dry-run",
        )
      ) {
        return json(singleStandardizationDryRun);
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/dry-run",
        )
      ) {
        return json(singleCatalogDryRun);
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/apply",
        )
      ) {
        return json(singleCatalogApply);
      }
      return json({}, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const picker = vi
      .spyOn(googlePicker, "openGooglePicker")
      .mockResolvedValueOnce({
        action: "picked",
        docs: [
          {
            id: "private-standard-document",
            name: "Один документ стандартизации",
          },
        ],
      })
      .mockResolvedValueOnce({
        action: "picked",
        docs: [
          {
            id: "private-catalog-document",
            name: "Один документ манифеста",
          },
        ],
      });

    renderPanel();
    expect(
      await screen.findByText(/Расширенный доступ подключён/),
    ).toBeInTheDocument();
    const standardization = screen.getByRole("region", {
      name: "Стандартизация Google Docs",
    });
    const catalog = screen.getByRole("region", {
      name: "Манифест Studio",
    });
    const standardMode = within(standardization).getByRole("combobox", {
      name: "Что обработать",
    });
    const catalogMode = within(catalog).getByRole("combobox", {
      name: "Что обработать",
    });

    await userEvent.selectOptions(standardMode, "single_document");
    expect(standardMode).toHaveValue("single_document");
    expect(catalogMode).toHaveValue("folder_tree");
    await userEvent.click(
      within(standardization).getByRole("button", {
        name: "Выбрать документ",
      }),
    );
    expect(picker).toHaveBeenNthCalledWith(
      1,
      "transcript-document",
      expect.objectContaining({ access_token: "private-access-token" }),
    );
    await userEvent.click(
      within(standardization).getByRole("button", {
        name: "Запустить dry-run",
      }),
    );
    const standardPreview = await within(standardization).findByLabelText(
      "Результат dry-run: Стандартизация Google Docs",
    );
    expect(standardPreview).toHaveTextContent(
      "Проверен один выбранный Google Doc",
    );
    expect(standardPreview).not.toHaveTextContent("Вложенных папок");

    await userEvent.selectOptions(catalogMode, "single_document");
    expect(standardMode).toHaveValue("single_document");
    await userEvent.click(
      within(catalog).getByRole("button", {
        name: "Выбрать документ",
      }),
    );
    expect(picker).toHaveBeenNthCalledWith(
      2,
      "transcript-document",
      expect.objectContaining({ access_token: "private-access-token" }),
    );
    await userEvent.click(
      within(catalog).getByRole("button", {
        name: "Запустить dry-run",
      }),
    );
    await within(catalog).findByLabelText(
      "Результат dry-run: Манифест Studio",
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
    expect(catalog).toHaveTextContent(
      "Новый dry-run должен показать сохранённые документы как уже учтённые",
    );
    expect(
      within(catalog).queryByRole("button", {
        name: /Добавить в манифест Studio/,
      }),
    ).not.toBeInTheDocument();

    const standardDryRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(
        "/api/transcript-maintenance/standardization/dry-run",
      ),
    );
    expect(standardDryRequest?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          selection_mode: "single_document",
          document_id: "private-standard-document",
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
        body: JSON.stringify({
          selection_mode: "single_document",
          document_id: "private-catalog-document",
          confirm_apply: true,
        }),
      }),
    );

    await userEvent.selectOptions(standardMode, "folder_tree");
    expect(
      within(standardization).queryByLabelText(
        "Результат dry-run: Стандартизация Google Docs",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(standardization).getByRole("button", {
        name: "Выбрать папку",
      }),
    ).toBeEnabled();
    expect(catalogMode).toHaveValue("single_document");
    for (const privateValue of [
      "private-access-token",
      "private-standard-document",
      "private-catalog-document",
    ]) {
      expect(document.body).not.toHaveTextContent(privateValue);
    }
  });

  it("clears the preview after selection changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/google/maintenance/connection")) {
          return json(readyMaintenanceConnection);
        }
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
    expect(
      await screen.findByText(/Расширенный доступ подключён/),
    ).toBeInTheDocument();
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
        if (url.endsWith("/api/google/maintenance/connection")) {
          return json(readyMaintenanceConnection);
        }
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
    expect(
      await screen.findByText(/Расширенный доступ подключён/),
    ).toBeInTheDocument();
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

  it("blocks operations until the server-only grant is ready", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/google/maintenance/connection")) {
        return json({
          ...readyMaintenanceConnection,
          connected: false,
          status: null,
          google_email: null,
          scopes: null,
          connected_at: null,
          account_match: false,
          scope_ready: false,
          ready: false,
        });
      }
      if (url.endsWith("/api/google/maintenance/oauth/start")) {
        return json(
          { detail: "private backend OAuth error" },
          false,
          503,
        );
      }
      return json({}, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPanel();

    expect(
      await screen.findByText(
        "Блокер: отдельный доступ Google для обслуживания не подключён.",
      ),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", {
      name: "Выбрать папку",
    })) {
      expect(button).toBeDisabled();
    }

    await userEvent.click(
      screen.getByRole("button", { name: "Подключить доступ" }),
    );

    expect(
      await screen.findByText(
        "Не удалось начать подключение доступа для обслуживания.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      "private backend OAuth error",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/google/maintenance/oauth/start",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-csrf-token": "csrf-safe",
        }),
      }),
    );
  });

  it("rejects malformed maintenance state without retaining raw fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/api/google/maintenance/connection")
          ? json({
              ...readyMaintenanceConnection,
              ready: "yes",
              raw_refresh_token: "raw-maintenance-token",
            })
          : json({}, false, 404),
      ),
    );

    renderPanel();

    expect(
      await screen.findByText(
        "Блокер: не удалось проверить состояние доступа Google для обслуживания.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("raw-maintenance-token");
    expect(
      screen.getByRole("button", { name: "Подключить доступ" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Повторить проверку доступа" }),
    ).toBeEnabled();
  });

  it("bounds a stalled maintenance read and retries explicitly", async () => {
    let requests = 0;
    let stalledSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (!url.endsWith("/api/google/maintenance/connection")) {
          return json({}, false, 404);
        }
        requests += 1;
        if (requests === 1) {
          stalledSignal = init?.signal;
          return new Promise<Response>((_resolve, reject) => {
            stalledSignal?.addEventListener("abort", () =>
              reject(new Error("raw-maintenance-timeout")),
            );
          });
        }
        return json(readyMaintenanceConnection);
      }),
    );
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 15_000 ? 1 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderPanel();
      expect(
        await screen.findByText(
          "Блокер: не удалось проверить состояние доступа Google для обслуживания.",
        ),
      ).toBeInTheDocument();
      expect(stalledSignal?.aborted).toBe(true);
      expect(document.body).not.toHaveTextContent("raw-maintenance-timeout");

      await userEvent.click(
        screen.getByRole("button", { name: "Повторить проверку доступа" }),
      );
      expect(
        await screen.findByText(/Расширенный доступ подключён/),
      ).toBeInTheDocument();
      expect(requests).toBe(2);
    } finally {
      timeoutSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("aborts the maintenance read on panel teardown", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        signal = init?.signal;
        return new Promise<Response>(() => undefined);
      }),
    );
    const { unmount } = renderPanel();
    await waitFor(() => expect(signal).toBeDefined());

    unmount();

    expect(signal?.aborted).toBe(true);
    vi.unstubAllGlobals();
  });
});
