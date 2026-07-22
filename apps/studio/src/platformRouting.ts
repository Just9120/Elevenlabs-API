export type Page = "dashboard" | "projects" | "settings";
export type SettingsSection = "account" | "diagnostics";
export type PlatformRoute = { page: Page; settingsSection: SettingsSection };

export function parsePlatformRoute(
  pathname = window.location.pathname,
): PlatformRoute {
  switch (pathname) {
    case "/projects":
      return { page: "projects", settingsSection: "account" };
    case "/settings":
      return { page: "settings", settingsSection: "account" };
    case "/settings/diagnostics":
      return { page: "settings", settingsSection: "diagnostics" };
    case "/":
    default:
      return { page: "dashboard", settingsSection: "account" };
  }
}

export function platformPathFor(
  page: Page,
  settingsSection: SettingsSection = "account",
) {
  if (page === "projects") return "/projects";
  if (page === "settings") {
    return settingsSection === "diagnostics"
      ? "/settings/diagnostics"
      : "/settings";
  }
  return "/";
}

export function pushPlatformRoute(
  page: Page,
  settingsSection: SettingsSection = "account",
) {
  const path = platformPathFor(page, settingsSection);
  if (window.location.pathname !== path) {
    window.history.pushState(window.history.state, "", path);
  }
}
