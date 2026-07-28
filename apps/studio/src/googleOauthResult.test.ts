import {
  consumeGoogleOauthResult,
  consumeGoogleMaintenanceOauthResult,
  googleMaintenanceOauthMessages,
  googleOauthMessages,
  type GoogleMaintenanceOauthResult,
  type GoogleOauthResult,
} from "./googleOauthResult";

const knownResults = Object.keys(googleOauthMessages) as GoogleOauthResult[];
const knownMaintenanceResults = Object.keys(
  googleMaintenanceOauthMessages,
) as GoogleMaintenanceOauthResult[];

describe("Google OAuth result", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it.each(knownResults)("consumes the allowlisted %s result", (result) => {
    const state = { source: "oauth-result-test" };
    window.history.replaceState(
      state,
      "",
      `/settings?google_oauth=${result}&keep=1#safe`,
    );
    const replaceState = vi.spyOn(window.history, "replaceState");

    expect(consumeGoogleOauthResult()).toBe(result);
    expect(replaceState).toHaveBeenCalledWith(
      state,
      "",
      "/settings?keep=1#safe",
    );
    expect(window.location.pathname).toBe("/settings");
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#safe");
  });

  it("removes and rejects an unknown result", () => {
    window.history.replaceState(
      {},
      "",
      "/?google_oauth=raw-unknown-value&keep=1#safe",
    );

    expect(consumeGoogleOauthResult()).toBeNull();
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#safe");
  });

  it.each(knownMaintenanceResults)(
    "consumes the allowlisted maintenance %s result",
    (result) => {
      window.history.replaceState(
        {},
        "",
        `/settings?google_maintenance_oauth=${result}&keep=1#safe`,
      );

      expect(consumeGoogleMaintenanceOauthResult()).toBe(result);
      expect(window.location.search).toBe("?keep=1");
      expect(window.location.hash).toBe("#safe");
    },
  );

  it("does not replace history when the result is absent", () => {
    window.history.replaceState({}, "", "/projects?keep=1#safe");
    const replaceState = vi.spyOn(window.history, "replaceState");

    expect(consumeGoogleOauthResult()).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.href).toContain("/projects?keep=1#safe");
  });

  it("contains only fixed safe user-facing messages", () => {
    expect(googleOauthMessages).toEqual({
      connected: "Google Drive подключён. Статус подключения обновлён.",
      cancelled: "Подключение Google Drive отменено.",
      invalid_callback:
        "Не удалось завершить подключение Google Drive. Запустите подключение ещё раз.",
      invalid_state:
        "Не удалось завершить подключение Google Drive. Запустите подключение ещё раз.",
      exchange_failed:
        "Google Drive не подключён. Повторите авторизацию и подтвердите запрошенный доступ.",
      offline_access_missing:
        "Google Drive не подключён. Повторите авторизацию и подтвердите запрошенный доступ.",
      scope_unavailable:
        "Google Drive не подключён: предоставлены не все обязательные разрешения.",
      account_identity_missing:
        "Google Drive не подключён: Google не подтвердил аккаунт.",
      account_mismatch:
        "Google Drive не подключён: выбран другой Google-аккаунт.",
      primary_connection_required:
        "Сначала подключите основной доступ Google Drive.",
    });
    expect(googleMaintenanceOauthMessages.account_mismatch).toBe(
      "Выберите тот же Google-аккаунт, который подключён к Studio.",
    );
  });
});
