import { describe, expect, it } from "vitest";
import {
  parseJobRetryResponse,
  parseOutputReconciliationCheckResponse,
  parseOutputReconciliationResponse,
} from "./jobRecoveryModel";

const retry = {
  job_id: "job-safe",
  job_status: "failed",
  available: true,
  reason: "partial_provider_resume_available",
  attempt_count: 1,
  max_attempts: 3,
  missing_output_count: 1,
  retry_safe_source_count: 1,
  resumable_provider_part_count: 2,
  provider_total_part_count: 4,
  provider_failure_code: "provider_rate_limited",
};

const reconciliation = {
  job_id: "job-safe",
  job_status: "failed",
  available: true,
  counts: {
    prepared: 0,
    creation_returned: 0,
    reconciliation_required: 1,
    resolved: 0,
    conflict: 0,
  },
  cases: [
    {
      job_source_id: "job-source-safe",
      status: "reconciliation_required",
      reason: "google_docs_timeout",
      prepared_at: "2026-08-14T09:00:00Z",
      last_checked_at: null,
      resolved: false,
      resolved_at: null,
    },
  ],
};

describe("job recovery DTO contracts", () => {
  it("accepts safe retry authority and discards private extras", () => {
    const parsed = parseJobRetryResponse(
      { ...retry, checkpoint_payload: "private-transcript" },
      "job-safe",
    );

    expect(parsed).toEqual(retry);
    expect(parsed).not.toHaveProperty("checkpoint_payload");
  });

  it("rejects inconsistent retry authority and part counts", () => {
    expect(
      parseJobRetryResponse({ ...retry, available: false }, "job-safe"),
    ).toBeNull();
    expect(
      parseJobRetryResponse(
        { ...retry, resumable_provider_part_count: 5 },
        "job-safe",
      ),
    ).toBeNull();
    expect(
      parseJobRetryResponse(
        { ...retry, retry_safe_source_count: 2 },
        "job-safe",
      ),
    ).toBeNull();
    expect(
      parseJobRetryResponse(
        { ...retry, job_status: "queued" },
        "job-safe",
      ),
    ).toBeNull();
  });

  it("accepts the exact queued readiness returned after retry", () => {
    expect(
      parseJobRetryResponse(
        {
          ...retry,
          job_status: "queued",
          reason: "available",
          missing_output_count: 0,
          retry_safe_source_count: 0,
          resumable_provider_part_count: 0,
          provider_total_part_count: 0,
          provider_failure_code: null,
        },
        "job-safe",
      ),
    ).toEqual({
      job_id: "job-safe",
      job_status: "queued",
      available: true,
      reason: "available",
      attempt_count: 1,
      max_attempts: 3,
      missing_output_count: 0,
      retry_safe_source_count: 0,
      resumable_provider_part_count: 0,
      provider_total_part_count: 0,
      provider_failure_code: null,
    });
  });

  it("accepts exact reconciliation authority and drops private timestamps", () => {
    const parsed = parseOutputReconciliationResponse(
      {
        ...reconciliation,
        raw_google_token: "private-token",
      },
      "job-safe",
    );

    expect(parsed).toEqual({
      ...reconciliation,
      cases: [
        {
          job_source_id: "job-source-safe",
          status: "reconciliation_required",
          reason: "google_docs_timeout",
          last_checked_at: null,
          resolved: false,
        },
      ],
    });
    expect(parsed).not.toHaveProperty("raw_google_token");
    expect(parsed?.cases[0]).not.toHaveProperty("prepared_at");
    expect(parsed?.cases[0]).not.toHaveProperty("resolved_at");
  });

  it("rejects inconsistent reconciliation counts and availability", () => {
    expect(
      parseOutputReconciliationResponse(
        {
          ...reconciliation,
          counts: { ...reconciliation.counts, conflict: 1 },
        },
        "job-safe",
      ),
    ).toBeNull();
    expect(
      parseOutputReconciliationResponse(
        { ...reconciliation, available: false },
        "job-safe",
      ),
    ).toBeNull();
    expect(
      parseOutputReconciliationResponse(
        {
          ...reconciliation,
          cases: [
            { ...reconciliation.cases[0], resolved: true },
          ],
        },
        "job-safe",
      ),
    ).toBeNull();
    expect(
      parseOutputReconciliationResponse(
        {
          ...reconciliation,
          cases: [
            { ...reconciliation.cases[0], prepared_at: "not-a-date" },
          ],
        },
        "job-safe",
      ),
    ).toBeNull();
  });

  it("validates reconciliation mutation summaries", () => {
    expect(
      parseOutputReconciliationCheckResponse(
        {
          job_id: "job-safe",
          checked: 3,
          resolved: 1,
          unresolved: 1,
          conflicts: 1,
          raw_google_response: "private-response",
        },
        "job-safe",
      ),
    ).toEqual({
      job_id: "job-safe",
      checked: 3,
      resolved: 1,
      unresolved: 1,
      conflicts: 1,
    });
    expect(
      parseOutputReconciliationCheckResponse(
        {
          job_id: "job-safe",
          checked: 3,
          resolved: 1,
          unresolved: 0,
          conflicts: 1,
        },
        "job-safe",
      ),
    ).toBeNull();
  });
});
