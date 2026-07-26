import {
  parsePlatformRoute,
  platformPathFor,
  pushPlatformRoute,
  resolveRequestedProjectsView,
} from "./platformRouting";

describe("platform routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it.each([
    ["/", { page: "dashboard", settingsSection: "account" }],
    ["/projects", { page: "projects", settingsSection: "account" }],
    ["/settings", { page: "settings", settingsSection: "account" }],
    [
      "/settings/diagnostics",
      { page: "settings", settingsSection: "diagnostics" },
    ],
    ["/unknown", { page: "dashboard", settingsSection: "account" }],
  ])("parses %s", (pathname, expected) => {
    expect(parsePlatformRoute(pathname)).toEqual(expected);
  });

  it("reads the browser pathname when no path is provided", () => {
    window.history.replaceState({}, "", "/projects");

    expect(parsePlatformRoute()).toEqual({
      page: "projects",
      settingsSection: "account",
    });
  });

  it.each([
    ["dashboard", "account", "/"],
    ["projects", "account", "/projects"],
    ["settings", "account", "/settings"],
    ["settings", "diagnostics", "/settings/diagnostics"],
  ] as const)("builds the %s/%s path", (page, section, expected) => {
    expect(platformPathFor(page, section)).toBe(expected);
  });

  it("pushes a changed route while preserving history state", () => {
    const state = { source: "routing-test" };
    window.history.replaceState(state, "", "/");
    const pushState = vi.spyOn(window.history, "pushState");

    pushPlatformRoute("settings", "diagnostics");

    expect(pushState).toHaveBeenCalledWith(
      state,
      "",
      "/settings/diagnostics",
    );
    expect(window.location.pathname).toBe("/settings/diagnostics");
  });

  it("does not add a duplicate history entry", () => {
    window.history.replaceState({}, "", "/projects");
    const pushState = vi.spyOn(window.history, "pushState");

    pushPlatformRoute("projects");

    expect(pushState).not.toHaveBeenCalled();
  });

  it.each([
    [null, true, 1, null],
    ["browse", true, 1, null],
    ["browse", false, 1, false],
    ["browse", false, 0, true],
    ["create", true, 1, true],
  ] as const)(
    "resolves projects view request %s while loading=%s with count=%s",
    (requestedView, loading, projectCount, expected) => {
      expect(
        resolveRequestedProjectsView(requestedView, {
          loading,
          projectCount,
        }),
      ).toBe(expected);
    },
  );
});
