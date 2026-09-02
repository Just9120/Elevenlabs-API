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
  target_standard: "transcript_doc",
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
  target_standard: "transcript_doc",
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
  target_standard: "transcript_doc",
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
  target_standard: "transcript_doc",
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

function renderPanel(
  pickerReady = true,
  view: "connections" | "workspace" = "workspace",
) {
  return render(
    <TranscriptCatalogMigrationPanel
      csrf="csrf-safe"
      onCsrf={vi.fn()}
      googleConnected={pickerReady}
      googleLoading={false}
      pickerReady={pickerReady}
      maintenanceOauthResult={null}
      view={view}
    />,
  );
}

const runIds = {
  standardizationDryRun: "00000000-0000-4000-8000-000000000001",
  standardizationApply: "00000000-0000-4000-8000-000000000002",
  catalogDryRun: "00000000-0000-4000-8000-000000000003",
  catalogApply: "00000000-0000-4000-8000-000000000004",
} as const;

function completedRun(
  id: string,
  result:
    | typeof standardizationDryRun
    | typeof standardizationApply
    | typeof catalogDryRun
    | typeof catalogApply,
  selectionMode: "folder_tree" | "single_document" = "folder_tree",
  targetName = "Безопасное название",
) {
  return {
    id,
    workflow: result.workflow,
    operation: result.operation,
    selection_mode: selectionMode,
    target_name: targetName,
    preview_run_id:
      result.operation === "apply"
        ? result.workflow === "standardization"
          ? runIds.standardizationDryRun
          : runIds.catalogDryRun
        : null,
    status: "succeeded",
    current_stage: "completed",
    progress: { completed: 2, total: 2 },
    result,
    error: null,
    created_at: "2026-08-29T00:00:00Z",
    started_at: "2026-08-29T00:00:01Z",
    finished_at: "2026-08-29T00:00:02Z",
  };
}

function failedRun(
  id: string,
  code: string,
  retryable = false,
  targetName = "Безопасное название",
) {
  return {
    id,
    workflow: "standardization",
    operation: "apply",
    selection_mode: "folder_tree",
    target_name: targetName,
    preview_run_id: runIds.standardizationDryRun,
    status: "failed",
    current_stage: "failed",
    progress: { completed: 0, total: null },
    result: null,
    error: { code, retryable },
    created_at: "2026-08-29T00:00:00Z",
    started_at: "2026-08-29T00:00:01Z",
    finished_at: "2026-08-29T00:00:02Z",
  };
}

function queuedRun(id: string, targetName: string) {
  return {
    id,
    workflow: "standardization",
    operation: "dry_run",
    selection_mode: "folder_tree",
    target_name: targetName,
    preview_run_id: null,
    status: "queued",
    current_stage: "queued",
    progress: { completed: 0, total: null },
    result: null,
    error: null,
    created_at: "2026-08-29T00:00:00Z",
    started_at: null,
    finished_at: null,
  };
}

function runningRun(
  id: string,
  targetName: string,
  completed: number,
  total: number,
) {
  return {
    ...queuedRun(id, targetName),
    status: "running",
    current_stage: "inspecting",
    progress: { completed, total },
    started_at: "2026-08-29T00:00:01Z",
  };
}

function isLatestRunRequest(url: string) {
  return url.includes("/api/transcript-maintenance/runs?workflow=");
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
      screen.getByRole("heading", { name: "Проверка и обновление Google Docs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Привести документы к текущему формату" }),
    ).toHaveTextContent("Сначала выполните проверку — она ничего не изменит");
    expect(
      screen.getByRole("region", { name: "Учесть готовые документы в Studio" }),
    ).toHaveTextContent("Содержимое Google Docs не изменяется");
    expect(
      screen.getByText(
        "Сначала подключите Google Drive.",
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
      if (isLatestRunRequest(url)) return json({ run: null });
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
      screen.getByRole("button", { name: "Сбросить учёт" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Нет" }));
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/api/transcript-catalog/clear"),
      ),
    ).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Сбросить учёт" }),
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
      if (isLatestRunRequest(url)) return json({ run: null });
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
        return json(
          completedRun(
            runIds.standardizationDryRun,
            standardizationDryRun,
          ),
          true,
          202,
        );
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/standardization/apply",
        )
      ) {
        return json(
          completedRun(runIds.standardizationApply, standardizationApply),
          true,
          202,
        );
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/dry-run",
        )
      ) {
        return json(
          completedRun(runIds.catalogDryRun, catalogDryRun),
          true,
          202,
        );
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/apply",
        )
      ) {
        return json(
          completedRun(runIds.catalogApply, catalogApply),
          true,
          202,
        );
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
      name: "Привести документы к текущему формату",
    });
    const catalog = screen.getByRole("region", {
      name: "Учесть готовые документы в Studio",
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
        name: "Проверить документы",
      }),
    );
    const standardPreview = await within(standardization).findByLabelText(
      "Результат проверки: Привести документы к текущему формату",
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
        name: "Обновить документы (1)",
      }),
    );
    expect(
      await within(standardization).findByLabelText(
        "Результат применения: Привести документы к текущему формату",
      ),
    ).toHaveTextContent("Документы обновлены");
    await userEvent.click(
      within(standardization).getByRole("button", { name: "Закрыть результат" }),
    );
    expect(
      within(standardization).queryByLabelText(
        "Результат применения: Привести документы к текущему формату",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(catalog).getByRole("button", { name: "Выбрать папку" }),
    );
    expect(picker).toHaveBeenNthCalledWith(
      2,
      "transcript-folder",
      expect.objectContaining({ access_token: "private-access-token" }),
    );
    await userEvent.click(
      within(catalog).getByRole("button", { name: "Проверить документы" }),
    );
    const catalogPreview = await within(catalog).findByLabelText(
      "Результат проверки: Учесть готовые документы в Studio",
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
        name: "Учесть документы (1)",
      }),
    );
    expect(
      await within(catalog).findByLabelText(
        "Результат применения: Учесть готовые документы в Studio",
      ),
    ).toHaveTextContent("Готовые документы учтены");
    expect(catalog).toHaveTextContent(
      "Результат сохранён в Studio",
    );
    expect(
      within(catalog).queryByRole("button", {
        name: /Учесть документы/,
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
        body: expect.any(String),
        headers: expect.objectContaining({
          "x-csrf-token": "csrf-safe",
        }),
      }),
    );
    expect(JSON.parse(String(standardDryRequest?.[1]?.body))).toEqual(
      expect.objectContaining({
        selection_mode: "folder_tree",
        folder_id: "private-standard-folder",
        target_name: "Архив стандартов",
        idempotency_key: expect.any(String),
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
        body: expect.any(String),
      }),
    );
    expect(JSON.parse(String(catalogApplyRequest?.[1]?.body))).toEqual({
      confirm_apply: true,
      preview_run_id: runIds.catalogDryRun,
      idempotency_key: expect.any(String),
    });
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

  it("bounds long document lists and filters them by name", async () => {
    const manyDocuments = {
      ...standardizationDryRun,
      items: Array.from({ length: 30 }, (_, position) => ({
        position,
        name: `Документ ${position + 1}`,
        standard_status: "outdated",
        source_creation_status: "authoritative",
        action: "standardize_document",
        reason_code: null,
      })),
      summary: {
        standardize_document_count: 30,
        unchanged_count: 0,
        blocked_count: 0,
      },
      selection_summary: {
        ...selectionSummary,
        google_document_count: 30,
      },
    } as typeof standardizationDryRun;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (isLatestRunRequest(url)) return json({ run: null });
        if (url.endsWith("/api/google/maintenance/connection")) {
          return json(readyMaintenanceConnection);
        }
        if (url.endsWith("/api/google/picker/session")) {
          return sessionResponse();
        }
        if (url.endsWith("/api/transcript-maintenance/standardization/dry-run")) {
          return json(
            completedRun(runIds.standardizationDryRun, manyDocuments),
            true,
            202,
          );
        }
        return json({}, false, 404);
      }),
    );
    vi.spyOn(googlePicker, "openGooglePicker").mockResolvedValue({
      action: "picked",
      docs: [{ id: "private-folder", name: "Большой архив" }],
    });

    renderPanel();
    await screen.findByText(/Расширенный доступ подключён/);
    const operation = screen.getByRole("region", {
      name: "Привести документы к текущему формату",
    });
    await userEvent.click(
      within(operation).getByRole("button", { name: "Выбрать папку" }),
    );
    await userEvent.click(
      within(operation).getByRole("button", { name: "Проверить документы" }),
    );
    const result = await within(operation).findByLabelText(
      "Результат проверки: Привести документы к текущему формату",
    );

    expect(within(result).getByText("Показано 25 из 30")).toBeInTheDocument();
    expect(within(result).getByText("Документ 25")).toBeInTheDocument();
    expect(within(result).queryByText("Документ 26")).not.toBeInTheDocument();
    await userEvent.click(
      within(result).getByRole("button", { name: /Показать ещё/ }),
    );
    expect(within(result).getByText("Показано 30 из 30")).toBeInTheDocument();
    expect(within(result).getByText("Документ 30")).toBeInTheDocument();

    await userEvent.type(
      within(result).getByRole("searchbox", { name: "Найти документ" }),
      "Документ 30",
    );
    expect(within(result).getByText("Показано 1 из 1")).toBeInTheDocument();
    expect(within(result).getByText("Документ 30")).toBeInTheDocument();
    expect(within(result).queryByText("Документ 1")).not.toBeInTheDocument();
  });

  it("supports an independent single-document mode for each operation", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (isLatestRunRequest(url)) return json({ run: null });
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
        return json(
          completedRun(
            runIds.standardizationDryRun,
            singleStandardizationDryRun,
            "single_document",
          ),
          true,
          202,
        );
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/dry-run",
        )
      ) {
        return json(
          completedRun(
            runIds.catalogDryRun,
            singleCatalogDryRun,
            "single_document",
          ),
          true,
          202,
        );
      }
      if (
        url.endsWith(
          "/api/transcript-maintenance/catalog-import/apply",
        )
      ) {
        return json(
          completedRun(
            runIds.catalogApply,
            singleCatalogApply,
            "single_document",
          ),
          true,
          202,
        );
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
      name: "Привести документы к текущему формату",
    });
    const catalog = screen.getByRole("region", {
      name: "Учесть готовые документы в Studio",
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
        name: "Проверить документы",
      }),
    );
    const standardPreview = await within(standardization).findByLabelText(
      "Результат проверки: Привести документы к текущему формату",
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
        name: "Проверить документы",
      }),
    );
    await within(catalog).findByLabelText(
      "Результат проверки: Учесть готовые документы в Studio",
    );
    await userEvent.click(
      within(catalog).getByRole("button", {
        name: "Учесть документы (1)",
      }),
    );
    expect(
      await within(catalog).findByLabelText(
        "Результат применения: Учесть готовые документы в Studio",
      ),
    ).toHaveTextContent("Готовые документы учтены");
    expect(catalog).toHaveTextContent(
      "Новая проверка покажет документы как уже учтённые",
    );
    expect(
      within(catalog).queryByRole("button", {
        name: /Учесть документы/,
      }),
    ).not.toBeInTheDocument();

    const standardDryRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(
        "/api/transcript-maintenance/standardization/dry-run",
      ),
    );
    expect(standardDryRequest?.[1]).toEqual(
      expect.objectContaining({
        body: expect.any(String),
      }),
    );
    expect(JSON.parse(String(standardDryRequest?.[1]?.body))).toEqual(
      expect.objectContaining({
        selection_mode: "single_document",
        document_id: "private-standard-document",
        target_name: "Один документ стандартизации",
        idempotency_key: expect.any(String),
      }),
    );
    const catalogApplyRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(
        "/api/transcript-maintenance/catalog-import/apply",
      ),
    );
    expect(catalogApplyRequest?.[1]).toEqual(
      expect.objectContaining({
        body: expect.any(String),
      }),
    );
    expect(JSON.parse(String(catalogApplyRequest?.[1]?.body))).toEqual({
      confirm_apply: true,
      preview_run_id: runIds.catalogDryRun,
      idempotency_key: expect.any(String),
    });

    await userEvent.selectOptions(standardMode, "folder_tree");
    expect(
      within(standardization).queryByLabelText(
        "Результат проверки: Привести документы к текущему формату",
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
        if (isLatestRunRequest(url)) return json({ run: null });
        if (url.endsWith("/api/google/maintenance/connection")) {
          return json(readyMaintenanceConnection);
        }
        if (url.endsWith("/api/google/picker/session")) {
          return sessionResponse();
        }
        if (url.endsWith("/standardization/dry-run")) {
          return json(
            completedRun(
              runIds.standardizationDryRun,
              standardizationDryRun,
              "folder_tree",
              "Архив",
            ),
            true,
            202,
          );
        }
        return json({}, false, 404);
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
      name: "Привести документы к текущему формату",
    });

    await userEvent.click(
      within(region).getByRole("button", { name: "Выбрать папку" }),
    );
    await userEvent.click(
      within(region).getByRole("button", { name: "Проверить документы" }),
    );
    await within(region).findByLabelText(
      "Результат проверки: Привести документы к текущему формату",
    );

    await userEvent.click(
      within(region).getByRole("button", { name: "Сменить папку" }),
    );

    expect(
      within(region).queryByLabelText(
        "Результат проверки: Привести документы к текущему формату",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(region).queryByRole("button", {
        name: "Обновить документы (1)",
      }),
    ).not.toBeInTheDocument();
    expect(region).toHaveTextContent("Корневая папка: Другой архив");
  });

  it("restores a durable run and follows it to completion after reload", async () => {
    const queued = queuedRun(
      runIds.standardizationDryRun,
      "Архив после перезагрузки",
    );
    const completed = completedRun(
      runIds.standardizationDryRun,
      standardizationDryRun,
      "folder_tree",
      "Архив после перезагрузки",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/google/maintenance/connection")) {
          return json(readyMaintenanceConnection);
        }
        if (url.includes("runs?workflow=standardization")) {
          return json({ run: queued });
        }
        if (url.includes("runs?workflow=catalog_import")) {
          return json({ run: null });
        }
        if (url.endsWith(`/api/transcript-maintenance/runs/${queued.id}`)) {
          return json(completed);
        }
        return json({}, false, 404);
      }),
    );
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 1_200 ? 100 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderPanel();
      const region = await screen.findByRole("region", {
        name: "Привести документы к текущему формату",
      });
      expect(
        await within(region).findByText("Ждёт начала обработки"),
      ).toBeInTheDocument();
      expect(
        await within(region).findByLabelText(
          "Результат проверки: Привести документы к текущему формату",
        ),
      ).toHaveTextContent("Лекция для обновления");
      expect(region).toHaveTextContent("Архив после перезагрузки");
      expect(
        within(region).getByRole("button", { name: "Сменить папку" }),
      ).toBeEnabled();
      expect(
        within(region).getByRole("button", { name: "Проверить документы" }),
      ).toBeDisabled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("keeps polling queued and running maintenance runs without a remount", async () => {
    const queued = queuedRun(
      runIds.standardizationDryRun,
      "Архив с live-прогрессом",
    );
    const running117 = runningRun(
      queued.id,
      queued.target_name,
      117,
      142,
    );
    const running118 = runningRun(
      queued.id,
      queued.target_name,
      118,
      142,
    );
    const completed = completedRun(
      queued.id,
      standardizationDryRun,
      "folder_tree",
      queued.target_name,
    );
    let statusRequestCount = 0;
    let resolveThirdStatus: ((response: Response) => void) | null = null;
    let resolveFourthStatus: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/google/maintenance/connection")) {
        return json(readyMaintenanceConnection);
      }
      if (url.includes("runs?workflow=standardization")) {
        return json({ run: queued });
      }
      if (url.includes("runs?workflow=catalog_import")) {
        return json({ run: null });
      }
      if (url.endsWith(`/api/transcript-maintenance/runs/${queued.id}`)) {
        statusRequestCount += 1;
        if (statusRequestCount === 1) return json(queued);
        if (statusRequestCount === 2) return json(running117);
        if (statusRequestCount === 3) {
          return new Promise<Response>((resolve) => {
            resolveThirdStatus = resolve;
          });
        }
        if (statusRequestCount === 4) {
          return new Promise<Response>((resolve) => {
            resolveFourthStatus = resolve;
          });
        }
      }
      return json({}, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((callback, delay, ...args) =>
        nativeSetTimeout(
          callback,
          delay === 1_200 || delay === 2_000 ? 20 : (delay as number),
          ...args,
        )) as typeof setTimeout);

    try {
      renderPanel();
      const region = await screen.findByRole("region", {
        name: "Привести документы к текущему формату",
      });
      expect(await within(region).findByText("117 из 142")).toBeInTheDocument();
      await vi.waitFor(() => expect(statusRequestCount).toBe(3));
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/transcript-maintenance/runs/${queued.id}`),
        expect.objectContaining({ cache: "no-store" }),
      );

      resolveThirdStatus?.(await json(running118));
      expect(await within(region).findByText("118 из 142")).toBeInTheDocument();
      await vi.waitFor(() => expect(statusRequestCount).toBe(4));

      resolveFourthStatus?.(await json(completed));
      expect(
        await within(region).findByLabelText(
          "Результат проверки: Привести документы к текущему формату",
        ),
      ).toHaveTextContent("Лекция для обновления");
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("requires a fresh dry-run after a safe apply failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (isLatestRunRequest(url)) return json({ run: null });
        if (url.endsWith("/api/google/maintenance/connection")) {
          return json(readyMaintenanceConnection);
        }
        if (url.endsWith("/api/google/picker/session")) {
          return sessionResponse();
        }
        if (url.endsWith("/dry-run")) {
          return json(
            completedRun(
              runIds.standardizationDryRun,
              standardizationDryRun,
              "folder_tree",
              "Изменяемый архив",
            ),
            true,
            202,
          );
        }
        return json(
          failedRun(
            runIds.standardizationApply,
            "catalog_document_revision_changed",
            true,
            "Изменяемый архив",
          ),
          true,
          202,
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
      name: "Привести документы к текущему формату",
    });

    await userEvent.click(
      within(region).getByRole("button", { name: "Выбрать папку" }),
    );
    await userEvent.click(
      within(region).getByRole("button", { name: "Проверить документы" }),
    );
    await within(region).findByLabelText(
      "Результат проверки: Привести документы к текущему формату",
    );
    await userEvent.click(
      within(region).getByRole("button", {
        name: "Обновить документы (1)",
      }),
    );

    expect(
      await within(region).findByText(
        "Документ изменился после проверки. Запустите проверку заново.",
      ),
    ).toBeInTheDocument();
    expect(region).not.toHaveTextContent("private raw response");
    expect(
      within(region).queryByRole("button", {
        name: "Обновить документы (1)",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: "Проверить документы" }),
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

    renderPanel(true, "connections");

    expect(
      await screen.findByText(
        "Подключите расширенный доступ Google для готовых документов.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Выбрать папку" }),
    ).not.toBeInTheDocument();

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

    renderPanel(true, "connections");

    expect(
      await screen.findByText(
        "Не удалось проверить расширенный доступ Google.",
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
      renderPanel(true, "connections");
      expect(
        await screen.findByText(
          "Не удалось проверить расширенный доступ Google.",
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
    const { unmount } = renderPanel(true, "connections");
    await waitFor(() => expect(signal).toBeDefined());

    unmount();

    expect(signal?.aborted).toBe(true);
    vi.unstubAllGlobals();
  });
});
