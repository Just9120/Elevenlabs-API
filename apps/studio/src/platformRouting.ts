export type Page = "dashboard" | "audio" | "projects" | "settings";
export type SettingsSection =
  | "account"
  | "connections"
  | "files"
  | "appearance"
  | "diagnostics";
export type PlatformRoute = { page: Page; settingsSection: SettingsSection };

export function parsePlatformRoute(
  pathname = window.location.pathname,
): PlatformRoute {
  switch (pathname) {
    case "/audio":
      return { page: "audio", settingsSection: "account" };
    case "/transcriptions":
    case "/projects":
      return { page: "projects", settingsSection: "account" };
    case "/settings":
      return { page: "settings", settingsSection: "account" };
    case "/settings/connections":
      return { page: "settings", settingsSection: "connections" };
    case "/settings/files":
      return { page: "settings", settingsSection: "files" };
    case "/settings/appearance":
      return { page: "settings", settingsSection: "appearance" };
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
  if (page === "audio") return "/audio";
  if (page === "projects") return "/transcriptions";
  if (page === "settings") {
    return settingsSection === "account"
      ? "/settings"
      : `/settings/${settingsSection}`;
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
