import {
  parseCatalogMigrationApply,
  parseCatalogMigrationDryRun,
} from "./transcriptCatalogMigrationModel";

const scanSummary = {
  google_document_count: 2,
  nested_folder_count: 0,
  skipped_non_document_count: 1,
  unreadable_document_count: 0,
  pages_scanned: 1,
};

describe("transcript catalog migration response model", () => {
  it("parses only the browser-safe dry-run contract", () => {
    const parsed = parseCatalogMigrationDryRun({
      operation: "dry_run",
      target_standard: "transcript_doc_v1.2",
      items: [
        {
          position: 0,
          name: "Safe transcript",
          standard_status: "outdated",
          import_status: "not_imported",
          settings_status: "indeterminate",
          action: "standardize_and_import",
          reason_code: null,
          drive_document_id: "private-document",
        },
      ],
      summary: {
        import_metadata_count: 0,
        standardize_and_import_count: 1,
        standardize_document_count: 0,
        unchanged_count: 0,
        blocked_count: 0,
      },
      scan_summary: scanSummary,
      raw_google_response: "private-google-payload",
    });

    expect(parsed.items).toEqual([
      {
        position: 0,
        name: "Safe transcript",
        standard_status: "outdated",
        import_status: "not_imported",
        settings_status: "indeterminate",
        action: "standardize_and_import",
        reason_code: null,
      },
    ]);
    expect(JSON.stringify(parsed)).not.toContain("private-document");
    expect(JSON.stringify(parsed)).not.toContain("private-google-payload");
  });

  it("parses apply outcomes and rejects changed or incomplete contracts", () => {
    const apply = {
      operation: "apply",
      target_standard: "transcript_doc_v1.2",
      items: [
        {
          position: 0,
          name: "Safe transcript",
          action: "standardize_and_import",
          outcome: "imported",
          reason_code: null,
          standardization_outcome: "changed",
        },
      ],
      summary: {
        imported_count: 1,
        already_applied_count: 0,
        unchanged_count: 0,
        blocked_count: 0,
        standardization_required_count: 0,
        conflict_count: 0,
        document_standardized_count: 1,
        document_already_current_count: 0,
        document_standardization_blocked_count: 0,
      },
      scan_summary: scanSummary,
    };

    expect(parseCatalogMigrationApply(apply).items[0]).toMatchObject({
      outcome: "imported",
      standardization_outcome: "changed",
    });
    expect(() =>
      parseCatalogMigrationApply({
        ...apply,
        items: [{ ...apply.items[0], outcome: "provider_called" }],
      }),
    ).toThrow("invalid migration outcome");
    expect(() =>
      parseCatalogMigrationDryRun({
        operation: "dry_run",
        target_standard: "transcript_doc_v1.2",
        items: [],
        summary: {},
        scan_summary: scanSummary,
      }),
    ).toThrow("invalid dry-run summary.import_metadata_count");
  });

  it("rejects non-deterministic item positions and unsafe display names", () => {
    const base = {
      operation: "dry_run",
      target_standard: "transcript_doc_v1.2",
      summary: {
        import_metadata_count: 0,
        standardize_and_import_count: 0,
        standardize_document_count: 0,
        unchanged_count: 1,
        blocked_count: 0,
      },
      scan_summary: scanSummary,
    };
    const item = {
      position: 0,
      name: "Safe transcript",
      standard_status: "current",
      import_status: "imported_exact",
      settings_status: "exact",
      action: "unchanged",
      reason_code: null,
    };

    expect(() =>
      parseCatalogMigrationDryRun({
        ...base,
        items: [{ ...item, position: 4 }],
      }),
    ).toThrow("invalid item order");
    expect(() =>
      parseCatalogMigrationDryRun({
        ...base,
        items: [{ ...item, name: "x".repeat(241) }],
      }),
    ).toThrow("invalid document name");
  });
});
