import {
  parseTranscriptCatalogImportApply,
  parseTranscriptCatalogImportDryRun,
  parseTranscriptMaintenanceRun,
  parseTranscriptStandardizationApply,
  parseTranscriptStandardizationDryRun,
} from "./transcriptMaintenanceModel";

const selectionSummary = {
  google_document_count: 1,
  nested_folder_count: 2,
  skipped_non_document_count: 3,
  pages_scanned: 4,
  unreadable_document_count: 0,
};

describe("transcript maintenance response model", () => {
  it("parses durable run progress and rejects unsafe terminal shapes", () => {
    const queued = parseTranscriptMaintenanceRun({
      id: "00000000-0000-4000-8000-000000000001",
      workflow: "standardization",
      operation: "dry_run",
      selection_mode: "folder_tree",
      target_name: "Архив созвонов",
      preview_run_id: null,
      status: "queued",
      current_stage: "queued",
      progress: { completed: 0, total: null },
      result: null,
      error: null,
      created_at: "2026-08-29T00:00:00Z",
      started_at: null,
      finished_at: null,
      private_folder_id: "must-not-survive",
    });
    expect(queued.progress).toEqual({ completed: 0, total: null });
    expect(JSON.stringify(queued)).not.toContain("must-not-survive");

    expect(() =>
      parseTranscriptMaintenanceRun({
        ...queued,
        status: "succeeded",
        current_stage: "completed",
        result: null,
        finished_at: "2026-08-29T00:00:01Z",
      }),
    ).toThrow("invalid transcript maintenance run");
    expect(() =>
      parseTranscriptMaintenanceRun({
        ...queued,
        status: "failed",
        current_stage: "failed",
        error: {
          code: "catalog_google_timeout",
          retryable: "yes",
          raw_google_error: "private",
        },
        finished_at: "2026-08-29T00:00:01Z",
      }),
    ).toThrow("invalid maintenance error");
  });

  it("parses standardization without accepting catalog actions", () => {
    const dryRun = parseTranscriptStandardizationDryRun({
      workflow: "standardization",
      operation: "dry_run",
      target_standard: "transcript_doc",
      items: [
        {
          position: 0,
          name: "Safe document",
          standard_status: "outdated",
          source_creation_status: "authoritative",
          action: "standardize_document",
          reason_code: null,
          drive_document_id: "private-document",
        },
      ],
      summary: {
        standardize_document_count: 1,
        unchanged_count: 0,
        blocked_count: 0,
      },
      selection_summary: selectionSummary,
      raw_google_response: "private-google-payload",
    });
    const apply = parseTranscriptStandardizationApply({
      workflow: "standardization",
      operation: "apply",
      target_standard: "transcript_doc",
      items: [
        {
          position: 0,
          name: "Safe document",
          source_creation_status: "authoritative",
          action: "standardize_document",
          outcome: "standardized",
          reason_code: null,
        },
      ],
      summary: {
        standardized_count: 1,
        already_current_count: 0,
        blocked_count: 0,
      },
      selection_summary: selectionSummary,
    });

    expect(dryRun.items[0].action).toBe("standardize_document");
    expect(apply.items[0].outcome).toBe("standardized");
    expect(
      parseTranscriptStandardizationApply({
        ...apply,
        items: [
          {
            ...apply.items[0],
            outcome: "blocked",
            reason_code: "catalog_document_revision_changed",
          },
        ],
        summary: {
          standardized_count: 0,
          already_current_count: 0,
          blocked_count: 1,
        },
      }).items[0].reason_code,
    ).toBe("catalog_document_revision_changed");
    expect(JSON.stringify(dryRun)).not.toContain("private-document");
    expect(JSON.stringify(dryRun)).not.toContain("private-google-payload");
    expect(() =>
      parseTranscriptStandardizationDryRun({
        ...dryRun,
        items: [{ ...dryRun.items[0], action: "import_metadata" }],
      }),
    ).toThrow("invalid standardization action");
  });

  it("parses catalog import without accepting standardization actions", () => {
    const dryRun = parseTranscriptCatalogImportDryRun({
      workflow: "catalog_import",
      operation: "dry_run",
      target_standard: "transcript_doc",
      items: [
        {
          position: 0,
          name: "Safe document",
          standard_status: "current",
          import_status: "not_imported",
          settings_status: "indeterminate",
          action: "import_metadata",
          reason_code: null,
        },
      ],
      summary: {
        import_metadata_count: 1,
        unchanged_count: 0,
        blocked_count: 0,
      },
      selection_summary: selectionSummary,
    });
    const apply = parseTranscriptCatalogImportApply({
      workflow: "catalog_import",
      operation: "apply",
      target_standard: "transcript_doc",
      items: [
        {
          position: 0,
          name: "Safe document",
          action: "import_metadata",
          outcome: "imported",
          reason_code: null,
        },
      ],
      summary: {
        imported_count: 1,
        already_applied_count: 0,
        unchanged_count: 0,
        blocked_count: 0,
        standardization_required_count: 0,
        conflict_count: 0,
      },
      selection_summary: selectionSummary,
    });

    expect(dryRun.items[0].action).toBe("import_metadata");
    expect(apply.items[0].outcome).toBe("imported");
    expect(() =>
      parseTranscriptCatalogImportDryRun({
        ...dryRun,
        items: [{ ...dryRun.items[0], action: "standardize_document" }],
      }),
    ).toThrow("invalid catalog import action");
  });

  it("rejects cross-workflow, incomplete, and non-deterministic payloads", () => {
    expect(() =>
      parseTranscriptStandardizationDryRun({
        workflow: "catalog_import",
        operation: "dry_run",
        target_standard: "transcript_doc",
        items: [],
        summary: {
          standardize_document_count: 0,
          unchanged_count: 0,
          blocked_count: 0,
        },
        selection_summary: selectionSummary,
      }),
    ).toThrow("invalid transcript maintenance response");
    expect(() =>
      parseTranscriptCatalogImportApply({
        workflow: "catalog_import",
        operation: "apply",
        target_standard: "transcript_doc",
        items: [],
        summary: {},
        selection_summary: selectionSummary,
      }),
    ).toThrow("invalid catalog import apply summary.imported_count");
    expect(() =>
      parseTranscriptCatalogImportDryRun({
        workflow: "catalog_import",
        operation: "dry_run",
        target_standard: "transcript_doc",
        items: [
          {
            position: 2,
            name: "Safe document",
            standard_status: "current",
            import_status: "not_imported",
            settings_status: "indeterminate",
            action: "import_metadata",
            reason_code: null,
          },
        ],
        summary: {
          import_metadata_count: 1,
          unchanged_count: 0,
          blocked_count: 0,
        },
        selection_summary: selectionSummary,
      }),
    ).toThrow("invalid item order");
  });
});
