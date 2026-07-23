export type AnalyticsDurationSummary = {
  sample_count: number;
  average_seconds: number | null;
  p50_seconds: number | null;
  p95_seconds: number | null;
};

export type TranscriptionAnalytics = {
  scope: "project_all_time";
  totals: {
    jobs: number;
    sources: number;
    outputs: number;
  };
  outcomes: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  configuration: {
    provider_model: {
      elevenlabs_scribe_v2: number;
      unknown: number;
    };
    language_mode: {
      ru: number;
      detect: number;
      other: number;
    };
    diarization: {
      enabled: number;
      disabled: number;
    };
  };
  durations: {
    queue: AnalyticsDurationSummary;
    processing: AnalyticsDurationSummary;
    provider_processing: AnalyticsDurationSummary;
    post_provider_output: AnalyticsDurationSummary;
  };
};

const EXACT_KEYS = {
  root: ["scope", "totals", "outcomes", "configuration", "durations"],
  totals: ["jobs", "sources", "outputs"],
  outcomes: ["queued", "processing", "completed", "failed", "cancelled"],
  configuration: ["provider_model", "language_mode", "diarization"],
  providerModel: ["elevenlabs_scribe_v2", "unknown"],
  languageMode: ["ru", "detect", "other"],
  diarization: ["enabled", "disabled"],
  durations: [
    "queue",
    "processing",
    "provider_processing",
    "post_provider_output",
  ],
  durationSummary: [
    "sample_count",
    "average_seconds",
    "p50_seconds",
    "p95_seconds",
  ],
} as const;

export function parseTranscriptionAnalytics(
  value: unknown,
): TranscriptionAnalytics | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, EXACT_KEYS.root) ||
    value.scope !== "project_all_time" ||
    !isCountRecord(value.totals, EXACT_KEYS.totals) ||
    !isCountRecord(value.outcomes, EXACT_KEYS.outcomes) ||
    !isRecord(value.configuration) ||
    !hasExactKeys(value.configuration, EXACT_KEYS.configuration) ||
    !isCountRecord(
      value.configuration.provider_model,
      EXACT_KEYS.providerModel,
    ) ||
    !isCountRecord(
      value.configuration.language_mode,
      EXACT_KEYS.languageMode,
    ) ||
    !isCountRecord(
      value.configuration.diarization,
      EXACT_KEYS.diarization,
    ) ||
    !isRecord(value.durations) ||
    !hasExactKeys(value.durations, EXACT_KEYS.durations)
  ) {
    return null;
  }
  for (const key of EXACT_KEYS.durations) {
    if (!isDurationSummary(value.durations[key])) return null;
  }
  if (
    sumRecord(value.outcomes) !== value.totals.jobs ||
    sumRecord(value.configuration.provider_model) !== value.totals.jobs ||
    sumRecord(value.configuration.language_mode) !== value.totals.jobs ||
    sumRecord(value.configuration.diarization) !== value.totals.jobs
  ) {
    return null;
  }
  return value as TranscriptionAnalytics;
}

function isDurationSummary(value: unknown): value is AnalyticsDurationSummary {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, EXACT_KEYS.durationSummary) ||
    !isNonNegativeInteger(value.sample_count)
  ) {
    return false;
  }
  const values = [
    value.average_seconds,
    value.p50_seconds,
    value.p95_seconds,
  ];
  if (value.sample_count === 0) return values.every((item) => item === null);
  return values.every(isNonNegativeFiniteNumber);
}

function isCountRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, number> {
  return (
    isRecord(value) &&
    hasExactKeys(value, keys) &&
    keys.every((key) => isNonNegativeInteger(value[key]))
  );
}

function sumRecord(value: Record<string, unknown>) {
  return Object.values(value).reduce<number>(
    (total, item) => total + (typeof item === "number" ? item : 0),
    0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
