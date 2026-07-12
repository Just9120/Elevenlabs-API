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

declare global {
  interface Window {
    gapi?: { load: (name: string, cb: () => void) => void };
    google?: {
      picker?: {
        Action: { PICKED: string; CANCEL: string };
        DocsView: new (...args: unknown[]) => {
          setIncludeFolders?: (value: boolean) => unknown;
          setSelectFolderEnabled?: (value: boolean) => unknown;
          setMimeTypes?: (value: string) => unknown;
        };
        PickerBuilder: new () => {
          addView: (view: unknown) => Window["google"] extends { picker: { PickerBuilder: new () => infer B } } ? B : unknown;
          enableFeature: (feature: unknown) => Window["google"] extends { picker: { PickerBuilder: new () => infer B } } ? B : unknown;
          setOAuthToken: (token: string) => Window["google"] extends { picker: { PickerBuilder: new () => infer B } } ? B : unknown;
          setDeveloperKey: (key: string) => Window["google"] extends { picker: { PickerBuilder: new () => infer B } } ? B : unknown;
          setAppId: (id: string) => Window["google"] extends { picker: { PickerBuilder: new () => infer B } } ? B : unknown;
          setCallback: (cb: (data: unknown) => void) => Window["google"] extends { picker: { PickerBuilder: new () => infer B } } ? B : unknown;
          build: () => { setVisible: (visible: boolean) => void };
        };
        ViewId: { DOCS: string; FOLDERS: string };
        Feature: { MULTISELECT_ENABLED: string; NAV_HIDDEN?: string };
      };
    };
  }
}

let loader: Promise<void> | null = null;

export function loadGooglePicker(): Promise<void> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-studio-google-picker="true"]',
    );
    const onReady = () => {
      window.gapi?.load("picker", () => resolve());
    };
    if (existing) {
      onReady();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.studioGooglePicker = "true";
    script.onload = onReady;
    script.onerror = () => reject(new Error("Google Picker не загрузился"));
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
    const clear = () => {
      token = "";
    };
    const callback = (data: unknown) => {
      const action = (data as { action?: unknown }).action;
      if (action === pickerApi.Action.PICKED) {
        const docs = selectedDocs(data);
        clear();
        resolve({ action: "picked", docs });
      } else if (action === pickerApi.Action.CANCEL) {
        clear();
        resolve({ action: "cancel" });
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
      const picker = builder.build();
      picker.setVisible(true);
    } catch {
      clear();
      resolve({ action: "error", message: "Не удалось открыть Google Picker" });
    }
  });
}
