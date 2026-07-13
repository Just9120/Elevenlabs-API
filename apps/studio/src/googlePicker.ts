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
  setMode: (mode: string) => PickerView;
  setParent: (parentId: string) => PickerView;
};
type PickerBuilder = {
  addView: (view: PickerView) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setCallback: (cb: PickerCallback) => PickerBuilder;
  setLocale: (locale: string) => PickerBuilder;
  setSize: (width: number, height: number) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  setOrigin: (origin: string) => PickerBuilder;
  setMaxItems: (maxItems: number) => PickerBuilder;
  setSelectableMimeTypes: (mimeTypes: string) => PickerBuilder;
  build: () => PickerInstance;
};
type PickerApi = {
  Action: { PICKED: string; CANCEL: string; ERROR: string };
  DocsView: new (viewId: string) => PickerView;
  PickerBuilder: new () => PickerBuilder;
  ViewId: { DOCS: string; FOLDERS: string };
  DocsViewMode: { LIST: string };
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
const PICKER_LOCALE = "ru";
const MY_DRIVE_ROOT_PARENT = "root";
const SOURCE_PICKER_TITLE = "Выберите аудио или видео";
const OUTPUT_FOLDER_PICKER_TITLE = "Выберите папку для результатов";
const SOURCE_SELECTABLE_MIME_TYPES = "audio/*,video/*,application/ogg";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const PICKER_MIN_WIDTH = 566;
const PICKER_MIN_HEIGHT = 350;
const PICKER_VIEWPORT_MARGIN = 48;
const PICKER_DESKTOP_MAX_WIDTH = 1051;
const PICKER_DESKTOP_MAX_HEIGHT = 650;
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

export function computeGooglePickerSize(viewportWidth: number, viewportHeight: number): { width: number; height: number } {
  const availableWidth = Math.max(PICKER_MIN_WIDTH, Math.floor(viewportWidth - PICKER_VIEWPORT_MARGIN));
  const availableHeight = Math.max(PICKER_MIN_HEIGHT, Math.floor(viewportHeight - PICKER_VIEWPORT_MARGIN));
  return {
    width: Math.max(PICKER_MIN_WIDTH, Math.min(PICKER_DESKTOP_MAX_WIDTH, availableWidth)),
    height: Math.max(PICKER_MIN_HEIGHT, Math.min(PICKER_DESKTOP_MAX_HEIGHT, availableHeight)),
  };
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
      view.setMode(pickerApi.DocsViewMode.LIST);
      view.setParent(MY_DRIVE_ROOT_PARENT);
      view.setIncludeFolders?.(true);
      if (mode === "output-folder") {
        view.setMimeTypes?.(FOLDER_MIME_TYPE);
        view.setSelectFolderEnabled?.(true);
      } else {
        view.setMimeTypes?.(SOURCE_SELECTABLE_MIME_TYPES);
      }
      const { width, height } = computeGooglePickerSize(window.innerWidth, window.innerHeight);
      const builder = new pickerApi.PickerBuilder();
      builder.addView(view);
      builder.setLocale(PICKER_LOCALE);
      builder.setSize(width, height);
      builder.setTitle(mode === "output-folder" ? OUTPUT_FOLDER_PICKER_TITLE : SOURCE_PICKER_TITLE);
      builder.setOrigin(window.location.origin);
      builder.setMaxItems(mode === "output-folder" ? 1 : 50);
      builder.setSelectableMimeTypes(mode === "output-folder" ? FOLDER_MIME_TYPE : SOURCE_SELECTABLE_MIME_TYPES);
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
