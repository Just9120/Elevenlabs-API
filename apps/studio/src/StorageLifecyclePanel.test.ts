import { __storageLifecycleTest } from "./StorageLifecyclePanel";


const lifecycle = {
  classes: [
    {
      reference_class: "transcription",
      label: "Транскрибации",
      storage_ready: true,
      provider_lifecycle_declared: true,
      effective_retention_seconds: 259200,
      retention_applies_to_new_uploads_only: true,
    },
    {
      reference_class: "audio_processing",
      label: "Подготовка аудио",
      storage_ready: true,
      provider_lifecycle_declared: true,
      effective_retention_seconds: 259200,
      retention_applies_to_new_uploads_only: true,
    },
  ],
  multipart: {
    threshold_bytes: 16777216,
    part_size_bytes: 8388608,
    abandoned_session_ttl_seconds: 3600,
  },
  reconciliation: {
    available: true,
    dry_run_default: true,
    apply_requires_confirmation: true,
    minimum_orphan_age_seconds: 86400,
    scan_limit: 500,
    apply_limit: 100,
  },
};


describe("storage lifecycle browser contract", () => {
  it("accepts only the bounded user-facing lifecycle shape", () => {
    expect(__storageLifecycleTest.parseLifecycle(lifecycle)).toEqual(lifecycle);
    expect(
      __storageLifecycleTest.parseLifecycle({
        ...lifecycle,
        reconciliation: {
          ...lifecycle.reconciliation,
          dry_run_default: false,
        },
      }),
    ).toBeNull();
    expect(
      __storageLifecycleTest.parseLifecycle({
        ...lifecycle,
        classes: [...lifecycle.classes, lifecycle.classes[0]],
      }),
    ).toBeNull();
  });

  it("requires a signed plan before the destructive action becomes available", () => {
    expect(
      __storageLifecycleTest.parsePreview({
        status: "ready",
        scanned_count: 12,
        protected_recent_count: 2,
        orphan_count: 1,
        orphan_bytes: 4096,
        plan_token: "a".repeat(64),
        plan_expires_at: "2026-09-01T12:00:00Z",
        apply_available: true,
      }),
    ).not.toBeNull();
    expect(
      __storageLifecycleTest.parsePreview({
        status: "truncated",
        scanned_count: 500,
        protected_recent_count: 0,
        orphan_count: 1,
        orphan_bytes: 4096,
        plan_token: "a".repeat(64),
        plan_expires_at: "2026-09-01T12:00:00Z",
        apply_available: true,
      }),
    ).toBeNull();
  });
});
