import {
  parseTranscriptCatalogImportApply,
  parseTranscriptCatalogImportDryRun,
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
  it("parses standardization without accepting catalog actions", () => {
    const dryRun = parseTranscriptStandardizationDryRun({
      workflow: "standardization",
      operation: "dry_run",
      target_standard: "transcript_doc_v1.2",
      items: [
        {
          position: 0,
          name: "Safe document",
          standard_status: "outdated",
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
      target_standard: "transcript_doc_v1.2",
      items: [
        {
          position: 0,
          name: "Safe document",
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
      target_standard: "transcript_doc_v1.2",
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
      target_standard: "transcript_doc_v1.2",
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
        target_standard: "transcript_doc_v1.2",
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
        target_standard: "transcript_doc_v1.2",
        items: [],
        summary: {},
        selection_summary: selectionSummary,
      }),
    ).toThrow("invalid catalog import apply summary.imported_count");
    expect(() =>
      parseTranscriptCatalogImportDryRun({
        workflow: "catalog_import",
        operation: "dry_run",
        target_standard: "transcript_doc_v1.2",
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
