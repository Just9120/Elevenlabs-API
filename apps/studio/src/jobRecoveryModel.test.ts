import { retryUnavailableLabel } from "./jobRecoveryModel";

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
});
