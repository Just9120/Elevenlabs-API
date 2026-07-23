import { describe, expect, it } from "vitest";
import { ApiError } from "./apiClient";
import { googlePickerFailureMessage } from "./googlePickerErrors";

describe("Google Picker safe failure messages", () => {
  it.each([
    "google_connection_missing",
    "google_connection_inactive",
    "google_reauthorization_required",
    "google_scope_unavailable",
  ])("requests reconnect for %s", (reason) => {
    const error = new ApiError(409, "generic", { detail: reason });
    expect(googlePickerFailureMessage(error)).toBe(
      "Переподключите Google Drive в настройках и повторите выбор.",
    );
  });

  it.each(["google_config_unavailable", "google_picker_not_configured"])(
    "reports unavailable configuration for %s",
    (reason) => {
      const error = new ApiError(503, "generic", { detail: reason });
      expect(googlePickerFailureMessage(error)).toBe(
        "Google Picker не настроен. Обратитесь к администратору.",
      );
    },
  );

  it("keeps transient and unknown backend details safe", () => {
    expect(
      googlePickerFailureMessage(
        new ApiError(502, "generic", { detail: "google_token_unavailable" }),
      ),
    ).toContain("Google Drive временно недоступен");
    expect(
      googlePickerFailureMessage(
        new ApiError(500, "generic", {
          detail: "raw provider response with token",
        }),
      ),
    ).toBeNull();
  });
});
