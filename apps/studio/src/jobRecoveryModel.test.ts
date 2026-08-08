import {
  isPartialProviderRestart,
  isPartialProviderResume,
  providerFailureLabel,
  retryUnavailableLabel,
} from "./jobRecoveryModel";

describe("job recovery model", () => {
  it.each([
    [
      "provider_outcome_uncertain",
      "Повтор недоступен: результат внешнего вызова не определён",
    ],
    [
      "output_reconciliation_required",
      "Требуется проверка созданного документа",
    ],
    ["attempt_limit_reached", "Достигнут предел попыток"],
    ["source_not_retryable", "Повтор недоступен"],
    ["available", ""],
    [undefined, ""],
  ])("maps retry reason %s to a safe user-facing label", (reason, label) => {
    expect(retryUnavailableLabel(reason)).toBe(label);
  });

  it("distinguishes remaining-part continuation from full restart", () => {
    const base = {
      job_id: "job-1",
      job_status: "failed",
      available: true,
      attempt_count: 1,
      max_attempts: 3,
      missing_output_count: 1,
      retry_safe_source_count: 1,
    };
    expect(
      isPartialProviderResume({
        ...base,
        reason: "partial_provider_resume_available",
      }),
    ).toBe(true);
    expect(
      isPartialProviderRestart({
        ...base,
        reason: "partial_provider_restart_available",
      }),
    ).toBe(true);
  });

  it("maps only fixed safe provider categories", () => {
    expect(providerFailureLabel("provider_rate_limited")).toBe(
      "ElevenLabs ограничил частоту запросов",
    );
    expect(providerFailureLabel("raw-secret-detail")).toBe(
      "Не удалось обработать следующую часть",
    );
  });
});
