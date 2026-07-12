export type PickerMode = "sources" | "output-folder";
export type PickerSelection = { id: string; name?: string; mimeType?: string };
export type PickerResult =
  | { action: "picked"; docs: PickerSelection[] }
  | { action: "cancel" }
  | { action: "error"; message: string };
export type PickerSession = {
  access_token: string;
  api_key: string;
  app_id: string;
  scope_ready: boolean;
};

type PickerCallback = (data: unknown) => void;
type PickerInstance = { setVisible: (visible: boolean) => void };
type PickerView = {
  setIncludeFolders?: (value: boolean) => PickerView;
  setSelectFolderEnabled?: (value: boolean) => PickerView;
  setMimeTypes?: (value: string) => PickerView;
};
type PickerBuilder = {
  addView: (view: PickerView) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setCallback: (cb: PickerCallback) => PickerBuilder;
  build: () => PickerInstance;
};
type PickerApi = {
  Action: { PICKED: string; CANCEL: string; ERROR: string };
  DocsView: new (viewId: string) => PickerView;
  PickerBuilder: new () => PickerBuilder;
  ViewId: { DOCS: string; FOLDERS: string };
  Feature: { MULTISELECT_ENABLED: string; NAV_HIDDEN?: string };
};

declare global {
  interface Window {
    gapi?: { load: (name: string, cb: () => void) => void };
    google?: { picker?: PickerApi };
  }
}

const SCRIPT_SELECTOR = 'script[data-studio-google-picker="true"]';
const SCRIPT_TIMEOUT_MS = 10000;
let loader: Promise<void> | null = null;

export function resetGooglePickerLoaderForTests() {
  loader = null;
}

function clearFailedPickerScript() {
  document.querySelectorAll<HTMLScriptElement>(SCRIPT_SELECTOR).forEach((script) => {
    if (script.dataset.studioGooglePickerLoaded !== "true") {
      script.remove();
    }
  });
}

function normalizedLoadError(): Error {
  return new Error("Google Picker не загрузился. Повторите попытку.");
}

export function loadGooglePicker(): Promise<void> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    let settled = false;
    let script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (error) {
        loader = null;
        clearFailedPickerScript();
        reject(error);
        return;
      }
      if (script) script.dataset.studioGooglePickerLoaded = "true";
      resolve();
    };
    const loadPickerApi = () => {
      try {
        if (!window.gapi) {
          finish(normalizedLoadError());
          return;
        }
        window.gapi.load("picker", () => finish());
      } catch {
        finish(normalizedLoadError());
      }
    };
    const timeout = window.setTimeout(() => finish(normalizedLoadError()), SCRIPT_TIMEOUT_MS);
    if (script?.dataset.studioGooglePickerLoaded === "true") {
      loadPickerApi();
      return;
    }
    if (script) script.remove();
    script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.studioGooglePicker = "true";
    script.onload = loadPickerApi;
    script.onerror = () => finish(normalizedLoadError());
    document.head.appendChild(script);
  });
  return loader;
}

function selectedDocs(data: unknown): PickerSelection[] {
  const payload = data as { docs?: unknown[] };
  if (!Array.isArray(payload.docs)) return [];
  return payload.docs
    .map((doc) => doc as { id?: unknown; name?: unknown; mimeType?: unknown })
    .filter((doc) => typeof doc.id === "string" && doc.id.trim())
    .map((doc) => ({
      id: String(doc.id),
      name: typeof doc.name === "string" ? doc.name : undefined,
      mimeType: typeof doc.mimeType === "string" ? doc.mimeType : undefined,
    }));
}

export async function openGooglePicker(
  mode: PickerMode,
  session: PickerSession,
): Promise<PickerResult> {
  await loadGooglePicker();
  return new Promise((resolve) => {
    const pickerApi = window.google?.picker;
    if (!pickerApi) {
      resolve({ action: "error", message: "Google Picker недоступен" });
      return;
    }
    let token = session.access_token;
    let completed = false;
    const finish = (result: PickerResult) => {
      if (completed) return;
      completed = true;
      token = "";
      resolve(result);
    };
    const callback = (data: unknown) => {
      const action = (data as { action?: unknown }).action;
      if (action === pickerApi.Action.PICKED) {
        finish({ action: "picked", docs: selectedDocs(data) });
      } else if (action === pickerApi.Action.CANCEL) {
        finish({ action: "cancel" });
      } else if (action === pickerApi.Action.ERROR) {
        finish({ action: "error", message: "Google Picker вернул ошибку. Повторите попытку." });
      }
    };
    try {
      const view = new pickerApi.DocsView(
        mode === "output-folder" ? pickerApi.ViewId.FOLDERS : pickerApi.ViewId.DOCS,
      );
      view.setIncludeFolders?.(true);
      if (mode === "output-folder") {
        view.setSelectFolderEnabled?.(true);
      } else {
        view.setMimeTypes?.("audio/*,video/*,application/ogg");
      }
      const builder = new pickerApi.PickerBuilder();
      builder.addView(view);
      if (mode === "sources") {
        builder.enableFeature(pickerApi.Feature.MULTISELECT_ENABLED);
      }
      builder.setOAuthToken(token);
      builder.setDeveloperKey(session.api_key);
      builder.setAppId(session.app_id);
      builder.setCallback(callback);
      builder.build().setVisible(true);
    } catch {
      finish({ action: "error", message: "Не удалось открыть Google Picker" });
    }
  });
}
