export type CatalogStandardStatus =
  | "current"
  | "outdated"
  | "unstructured"
  | "unreadable";
export type CatalogImportStatus =
  | "not_imported"
  | "imported_exact"
  | "conflict";
export type CatalogSettingsStatus = "exact" | "indeterminate";
export type CatalogMigrationAction =
  | "import_metadata"
  | "standardize_and_import"
  | "standardize_document"
  | "unchanged"
  | "blocked";
export type CatalogMigrationOutcome =
  | "imported"
  | "already_applied"
  | "unchanged"
  | "blocked"
  | "conflict";
export type CatalogStandardizationOutcome =
  | "not_required"
  | "changed"
  | "already_current"
  | "blocked";
export type CatalogMigrationBlockReason =
  | "catalog_conflict"
  | "document_unreadable";
export type CatalogMigrationApplyReason =
  | CatalogMigrationBlockReason
  | "catalog_metadata_conflict";

export type CatalogMigrationScanSummary = {
  google_document_count: number;
  nested_folder_count: number;
  skipped_non_document_count: number;
  unreadable_document_count: number;
  pages_scanned: number;
};

export type CatalogMigrationDryRun = {
  operation: "dry_run";
  target_standard: "transcript_doc_v1.2";
  items: {
    position: number;
    name: string;
    standard_status: CatalogStandardStatus;
    import_status: CatalogImportStatus;
    settings_status: CatalogSettingsStatus;
    action: CatalogMigrationAction;
    reason_code: CatalogMigrationBlockReason | null;
  }[];
  summary: {
    import_metadata_count: number;
    standardize_and_import_count: number;
    standardize_document_count: number;
    unchanged_count: number;
    blocked_count: number;
  };
  scan_summary: CatalogMigrationScanSummary;
};

export type CatalogMigrationApply = {
  operation: "apply";
  target_standard: "transcript_doc_v1.2";
  items: {
    position: number;
    name: string;
    action: CatalogMigrationAction;
    outcome: CatalogMigrationOutcome;
    reason_code: CatalogMigrationApplyReason | null;
    standardization_outcome: CatalogStandardizationOutcome;
  }[];
  summary: {
    imported_count: number;
    already_applied_count: number;
    unchanged_count: number;
    blocked_count: number;
    standardization_required_count: number;
    conflict_count: number;
    document_standardized_count: number;
    document_already_current_count: number;
    document_standardization_blocked_count: number;
  };
  scan_summary: CatalogMigrationScanSummary;
};

const STANDARD_STATUSES = new Set<CatalogStandardStatus>([
  "current",
  "outdated",
  "unstructured",
  "unreadable",
]);
const IMPORT_STATUSES = new Set<CatalogImportStatus>([
  "not_imported",
  "imported_exact",
  "conflict",
]);
const SETTINGS_STATUSES = new Set<CatalogSettingsStatus>([
  "exact",
  "indeterminate",
]);
const ACTIONS = new Set<CatalogMigrationAction>([
  "import_metadata",
  "standardize_and_import",
  "standardize_document",
  "unchanged",
  "blocked",
]);
const OUTCOMES = new Set<CatalogMigrationOutcome>([
  "imported",
  "already_applied",
  "unchanged",
  "blocked",
  "conflict",
]);
const STANDARDIZATION_OUTCOMES = new Set<CatalogStandardizationOutcome>([
  "not_required",
  "changed",
  "already_current",
  "blocked",
]);
const DRY_RUN_REASONS = new Set<CatalogMigrationBlockReason>([
  "catalog_conflict",
  "document_unreadable",
]);
const APPLY_REASONS = new Set<CatalogMigrationApplyReason>([
  ...DRY_RUN_REASONS,
  "catalog_metadata_conflict",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 240) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`invalid ${label}`);
  }
  return Number(value);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: Set<T>,
  label: string,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`invalid ${label}`);
  }
  return value as T;
}

function reasonValue<T extends string>(
  value: unknown,
  allowed: Set<T>,
  label: string,
): T | null {
  if (value === null) return null;
  return enumValue(value, allowed, label);
}

function summary<K extends string>(
  value: unknown,
  keys: readonly K[],
  label: string,
): Record<K, number> {
  const source = record(value, label);
  return Object.fromEntries(
    keys.map((key) => [
      key,
      nonNegativeInteger(source[key], `${label}.${key}`),
    ]),
  ) as Record<K, number>;
}

function scanSummary(value: unknown): CatalogMigrationScanSummary {
  return summary(
    value,
    [
      "google_document_count",
      "nested_folder_count",
      "skipped_non_document_count",
      "unreadable_document_count",
      "pages_scanned",
    ] as const,
    "scan summary",
  );
}

function payloadHeader(
  value: unknown,
  operation: "dry_run" | "apply",
): Record<string, unknown> {
  const source = record(value, "catalog migration response");
  if (
    source.operation !== operation ||
    source.target_standard !== "transcript_doc_v1.2" ||
    !Array.isArray(source.items)
  ) {
    throw new Error("invalid catalog migration response");
  }
  return source;
}

function itemPosition(
  item: Record<string, unknown>,
  expectedPosition: number,
): number {
  const position = nonNegativeInteger(item.position, "item position");
  if (position !== expectedPosition) throw new Error("invalid item order");
  return position;
}

export function parseCatalogMigrationDryRun(
  value: unknown,
): CatalogMigrationDryRun {
  const source = payloadHeader(value, "dry_run");
  const items = (source.items as unknown[]).map((value, index) => {
    const item = record(value, "dry-run item");
    return {
      position: itemPosition(item, index),
      name: text(item.name, "document name"),
      standard_status: enumValue(
        item.standard_status,
        STANDARD_STATUSES,
        "standard status",
      ),
      import_status: enumValue(
        item.import_status,
        IMPORT_STATUSES,
        "import status",
      ),
      settings_status: enumValue(
        item.settings_status,
        SETTINGS_STATUSES,
        "settings status",
      ),
      action: enumValue(item.action, ACTIONS, "migration action"),
      reason_code: reasonValue(
        item.reason_code,
        DRY_RUN_REASONS,
        "block reason",
      ),
    };
  });
  return {
    operation: "dry_run",
    target_standard: "transcript_doc_v1.2",
    items,
    summary: summary(
      source.summary,
      [
        "import_metadata_count",
        "standardize_and_import_count",
        "standardize_document_count",
        "unchanged_count",
        "blocked_count",
      ] as const,
      "dry-run summary",
    ),
    scan_summary: scanSummary(source.scan_summary),
  };
}

export function parseCatalogMigrationApply(
  value: unknown,
): CatalogMigrationApply {
  const source = payloadHeader(value, "apply");
  const items = (source.items as unknown[]).map((value, index) => {
    const item = record(value, "apply item");
    return {
      position: itemPosition(item, index),
      name: text(item.name, "document name"),
      action: enumValue(item.action, ACTIONS, "migration action"),
      outcome: enumValue(item.outcome, OUTCOMES, "migration outcome"),
      reason_code: reasonValue(
        item.reason_code,
        APPLY_REASONS,
        "apply reason",
      ),
      standardization_outcome: enumValue(
        item.standardization_outcome,
        STANDARDIZATION_OUTCOMES,
        "standardization outcome",
      ),
    };
  });
  return {
    operation: "apply",
    target_standard: "transcript_doc_v1.2",
    items,
    summary: summary(
      source.summary,
      [
        "imported_count",
        "already_applied_count",
        "unchanged_count",
        "blocked_count",
        "standardization_required_count",
        "conflict_count",
        "document_standardized_count",
        "document_already_current_count",
        "document_standardization_blocked_count",
      ] as const,
      "apply summary",
    ),
    scan_summary: scanSummary(source.scan_summary),
  };
}
