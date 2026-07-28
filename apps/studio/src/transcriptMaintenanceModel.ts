export type TranscriptMaintenanceWorkflow =
  | "standardization"
  | "catalog_import";
export type TranscriptStandardStatus =
  | "current"
  | "outdated"
  | "unstructured"
  | "unreadable";
export type TranscriptImportStatus =
  | "not_imported"
  | "imported_exact"
  | "conflict";
export type TranscriptSettingsStatus = "exact" | "indeterminate";
export type StandardizationAction =
  | "standardize_document"
  | "unchanged"
  | "blocked";
export type CatalogImportAction =
  | "import_metadata"
  | "unchanged"
  | "blocked";
export type StandardizationOutcome =
  | "standardized"
  | "already_current"
  | "blocked";
export type CatalogImportOutcome =
  | "imported"
  | "already_applied"
  | "unchanged"
  | "blocked"
  | "standardization_required"
  | "conflict";
export type MaintenanceReason =
  | "catalog_conflict"
  | "document_unreadable"
  | "standardization_required"
  | "catalog_metadata_conflict"
  | "catalog_document_unavailable"
  | "catalog_document_write_rejected"
  | "catalog_document_revision_changed"
  | "catalog_document_multiple_tabs"
  | "catalog_document_content_unsupported"
  | "catalog_document_classification_changed"
  | "catalog_document_empty"
  | "catalog_document_limit_exceeded"
  | "catalog_document_response_invalid";

export type TranscriptSelectionSummary = {
  selected_document_count: number;
  unreadable_document_count: number;
};

export type TranscriptStandardizationDryRun = {
  workflow: "standardization";
  operation: "dry_run";
  target_standard: "transcript_doc_v1.2";
  items: {
    position: number;
    name: string;
    standard_status: TranscriptStandardStatus;
    action: StandardizationAction;
    reason_code: MaintenanceReason | null;
  }[];
  summary: {
    standardize_document_count: number;
    unchanged_count: number;
    blocked_count: number;
  };
  selection_summary: TranscriptSelectionSummary;
};

export type TranscriptStandardizationApply = {
  workflow: "standardization";
  operation: "apply";
  target_standard: "transcript_doc_v1.2";
  items: {
    position: number;
    name: string;
    action: StandardizationAction;
    outcome: StandardizationOutcome;
    reason_code: MaintenanceReason | null;
  }[];
  summary: {
    standardized_count: number;
    already_current_count: number;
    blocked_count: number;
  };
  selection_summary: TranscriptSelectionSummary;
};

export type TranscriptCatalogImportDryRun = {
  workflow: "catalog_import";
  operation: "dry_run";
  target_standard: "transcript_doc_v1.2";
  items: {
    position: number;
    name: string;
    standard_status: TranscriptStandardStatus;
    import_status: TranscriptImportStatus;
    settings_status: TranscriptSettingsStatus;
    action: CatalogImportAction;
    reason_code: MaintenanceReason | null;
  }[];
  summary: {
    import_metadata_count: number;
    unchanged_count: number;
    blocked_count: number;
  };
  selection_summary: TranscriptSelectionSummary;
};

export type TranscriptCatalogImportApply = {
  workflow: "catalog_import";
  operation: "apply";
  target_standard: "transcript_doc_v1.2";
  items: {
    position: number;
    name: string;
    action: CatalogImportAction;
    outcome: CatalogImportOutcome;
    reason_code: MaintenanceReason | null;
  }[];
  summary: {
    imported_count: number;
    already_applied_count: number;
    unchanged_count: number;
    blocked_count: number;
    standardization_required_count: number;
    conflict_count: number;
  };
  selection_summary: TranscriptSelectionSummary;
};

export type TranscriptMaintenanceDryRun =
  | TranscriptStandardizationDryRun
  | TranscriptCatalogImportDryRun;
export type TranscriptMaintenanceApply =
  | TranscriptStandardizationApply
  | TranscriptCatalogImportApply;

const STANDARD_STATUSES = new Set<TranscriptStandardStatus>([
  "current",
  "outdated",
  "unstructured",
  "unreadable",
]);
const IMPORT_STATUSES = new Set<TranscriptImportStatus>([
  "not_imported",
  "imported_exact",
  "conflict",
]);
const SETTINGS_STATUSES = new Set<TranscriptSettingsStatus>([
  "exact",
  "indeterminate",
]);
const STANDARDIZATION_ACTIONS = new Set<StandardizationAction>([
  "standardize_document",
  "unchanged",
  "blocked",
]);
const CATALOG_ACTIONS = new Set<CatalogImportAction>([
  "import_metadata",
  "unchanged",
  "blocked",
]);
const STANDARDIZATION_OUTCOMES = new Set<StandardizationOutcome>([
  "standardized",
  "already_current",
  "blocked",
]);
const CATALOG_OUTCOMES = new Set<CatalogImportOutcome>([
  "imported",
  "already_applied",
  "unchanged",
  "blocked",
  "standardization_required",
  "conflict",
]);
const STANDARDIZATION_REASONS = new Set<MaintenanceReason>([
  "document_unreadable",
  "catalog_document_unavailable",
  "catalog_document_write_rejected",
  "catalog_document_revision_changed",
  "catalog_document_multiple_tabs",
  "catalog_document_content_unsupported",
  "catalog_document_classification_changed",
  "catalog_document_empty",
  "catalog_document_limit_exceeded",
  "catalog_document_response_invalid",
]);
const CATALOG_REASONS = new Set<MaintenanceReason>([
  "catalog_conflict",
  "document_unreadable",
  "standardization_required",
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

function reasonValue(
  value: unknown,
  allowed: Set<MaintenanceReason>,
): MaintenanceReason | null {
  if (value === null) return null;
  return enumValue(value, allowed, "maintenance reason");
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

function selectionSummary(value: unknown): TranscriptSelectionSummary {
  return summary(
    value,
    ["selected_document_count", "unreadable_document_count"] as const,
    "selection summary",
  );
}

function payloadHeader(
  value: unknown,
  workflow: TranscriptMaintenanceWorkflow,
  operation: "dry_run" | "apply",
): Record<string, unknown> {
  const source = record(value, "transcript maintenance response");
  if (
    source.workflow !== workflow ||
    source.operation !== operation ||
    source.target_standard !== "transcript_doc_v1.2" ||
    !Array.isArray(source.items)
  ) {
    throw new Error("invalid transcript maintenance response");
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

export function parseTranscriptStandardizationDryRun(
  value: unknown,
): TranscriptStandardizationDryRun {
  const source = payloadHeader(value, "standardization", "dry_run");
  const items = (source.items as unknown[]).map((value, index) => {
    const item = record(value, "standardization dry-run item");
    return {
      position: itemPosition(item, index),
      name: text(item.name, "document name"),
      standard_status: enumValue(
        item.standard_status,
        STANDARD_STATUSES,
        "standard status",
      ),
      action: enumValue(
        item.action,
        STANDARDIZATION_ACTIONS,
        "standardization action",
      ),
      reason_code: reasonValue(
        item.reason_code,
        STANDARDIZATION_REASONS,
      ),
    };
  });
  return {
    workflow: "standardization",
    operation: "dry_run",
    target_standard: "transcript_doc_v1.2",
    items,
    summary: summary(
      source.summary,
      [
        "standardize_document_count",
        "unchanged_count",
        "blocked_count",
      ] as const,
      "standardization dry-run summary",
    ),
    selection_summary: selectionSummary(source.selection_summary),
  };
}

export function parseTranscriptStandardizationApply(
  value: unknown,
): TranscriptStandardizationApply {
  const source = payloadHeader(value, "standardization", "apply");
  const items = (source.items as unknown[]).map((value, index) => {
    const item = record(value, "standardization apply item");
    return {
      position: itemPosition(item, index),
      name: text(item.name, "document name"),
      action: enumValue(
        item.action,
        STANDARDIZATION_ACTIONS,
        "standardization action",
      ),
      outcome: enumValue(
        item.outcome,
        STANDARDIZATION_OUTCOMES,
        "standardization outcome",
      ),
      reason_code: reasonValue(
        item.reason_code,
        STANDARDIZATION_REASONS,
      ),
    };
  });
  return {
    workflow: "standardization",
    operation: "apply",
    target_standard: "transcript_doc_v1.2",
    items,
    summary: summary(
      source.summary,
      ["standardized_count", "already_current_count", "blocked_count"] as const,
      "standardization apply summary",
    ),
    selection_summary: selectionSummary(source.selection_summary),
  };
}

export function parseTranscriptCatalogImportDryRun(
  value: unknown,
): TranscriptCatalogImportDryRun {
  const source = payloadHeader(value, "catalog_import", "dry_run");
  const items = (source.items as unknown[]).map((value, index) => {
    const item = record(value, "catalog import dry-run item");
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
      action: enumValue(
        item.action,
        CATALOG_ACTIONS,
        "catalog import action",
      ),
      reason_code: reasonValue(item.reason_code, CATALOG_REASONS),
    };
  });
  return {
    workflow: "catalog_import",
    operation: "dry_run",
    target_standard: "transcript_doc_v1.2",
    items,
    summary: summary(
      source.summary,
      ["import_metadata_count", "unchanged_count", "blocked_count"] as const,
      "catalog import dry-run summary",
    ),
    selection_summary: selectionSummary(source.selection_summary),
  };
}

export function parseTranscriptCatalogImportApply(
  value: unknown,
): TranscriptCatalogImportApply {
  const source = payloadHeader(value, "catalog_import", "apply");
  const items = (source.items as unknown[]).map((value, index) => {
    const item = record(value, "catalog import apply item");
    return {
      position: itemPosition(item, index),
      name: text(item.name, "document name"),
      action: enumValue(
        item.action,
        CATALOG_ACTIONS,
        "catalog import action",
      ),
      outcome: enumValue(
        item.outcome,
        CATALOG_OUTCOMES,
        "catalog import outcome",
      ),
      reason_code: reasonValue(item.reason_code, CATALOG_REASONS),
    };
  });
  return {
    workflow: "catalog_import",
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
      ] as const,
      "catalog import apply summary",
    ),
    selection_summary: selectionSummary(source.selection_summary),
  };
}
