import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import { lockDocumentScroll } from "./documentScrollLock";
import type {
  PickerResult,
  PickerSelection,
  PickerSession,
} from "./googlePicker";

const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_LIST_PAGES = 10;
const PAGE_SIZE = 1000;
const INTERACTION_TIMEOUT_MS = 300_000;

type DriveFolder = PickerSelection & { driveId?: string };

type DriveListPayload = {
  files?: unknown;
  nextPageToken?: unknown;
};

type SharedDrivePayload = {
  drives?: unknown;
  nextPageToken?: unknown;
};

function safeFolderName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 512)
    : fallback;
}

function parseFolder(value: unknown): DriveFolder | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  if (
    candidate.mimeType !== undefined &&
    candidate.mimeType !== FOLDER_MIME_TYPE
  ) {
    return null;
  }
  return {
    id: candidate.id,
    name: safeFolderName(candidate.name, "Папка Google Drive"),
    mimeType: FOLDER_MIME_TYPE,
    driveId:
      typeof candidate.driveId === "string" && candidate.driveId.trim()
        ? candidate.driveId
        : undefined,
  };
}

function parseSharedDrive(value: unknown): DriveFolder | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  return {
    id: candidate.id,
    name: safeFolderName(candidate.name, "Общий диск"),
    mimeType: FOLDER_MIME_TYPE,
    driveId: candidate.id,
  };
}

function driveQueryLiteral(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function driveApiUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${DRIVE_API_ROOT}${path}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  return url.toString();
}

async function fetchDriveJson(
  url: string,
  accessToken: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error("Google Drive folder request failed");
  }
  return response.json();
}

async function loadRootFolder(
  accessToken: string,
  signal: AbortSignal,
): Promise<DriveFolder> {
  const payload = await fetchDriveJson(
    driveApiUrl("/files/root", {
      fields: "id,name,mimeType,driveId",
      supportsAllDrives: "true",
    }),
    accessToken,
    signal,
  );
  const root = parseFolder(payload);
  if (!root) throw new Error("Google Drive root response is invalid");
  const candidate = payload as Record<string, unknown>;
  return { ...root, name: safeFolderName(candidate.name, "Мой диск") };
}

async function loadFolderPage(
  parent: DriveFolder,
  accessToken: string,
  signal: AbortSignal,
  pageToken?: string,
): Promise<{ folders: DriveFolder[]; nextPageToken?: string }> {
  const params: Record<string, string> = {
    q: `'${driveQueryLiteral(parent.id)}' in parents and trashed = false and mimeType = '${FOLDER_MIME_TYPE}'`,
    fields: "nextPageToken,files(id,name,mimeType,driveId)",
    pageSize: String(PAGE_SIZE),
    orderBy: "name_natural",
    spaces: "drive",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  };
  if (parent.driveId) {
    params.corpora = "drive";
    params.driveId = parent.driveId;
  }
  if (pageToken) params.pageToken = pageToken;
  const payload = (await fetchDriveJson(
    driveApiUrl("/files", params),
    accessToken,
    signal,
  )) as DriveListPayload;
  const files = Array.isArray(payload.files)
    ? payload.files
        .map(parseFolder)
        .filter((folder): folder is DriveFolder => folder !== null)
        .map((folder) => ({
          ...folder,
          driveId: folder.driveId ?? parent.driveId,
        }))
    : [];
  return {
    folders: files,
    nextPageToken:
      typeof payload.nextPageToken === "string" && payload.nextPageToken
        ? payload.nextPageToken
        : undefined,
  };
}

async function loadFolderChildren(
  parent: DriveFolder,
  accessToken: string,
  signal: AbortSignal,
): Promise<DriveFolder[]> {
  const folders: DriveFolder[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const result = await loadFolderPage(
      parent,
      accessToken,
      signal,
      pageToken,
    );
    folders.push(...result.folders);
    if (!result.nextPageToken) {
      return folders.sort((left, right) =>
        (left.name ?? "").localeCompare(right.name ?? "", "ru"),
      );
    }
    if (seenTokens.has(result.nextPageToken)) {
      throw new Error("Google Drive repeated a folder page token");
    }
    seenTokens.add(result.nextPageToken);
    pageToken = result.nextPageToken;
  }
  throw new Error("Google Drive folder listing exceeded the page limit");
}

async function loadSharedFolders(
  accessToken: string,
  signal: AbortSignal,
): Promise<DriveFolder[]> {
  const folders: DriveFolder[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const params: Record<string, string> = {
      q: `sharedWithMe = true and trashed = false and mimeType = '${FOLDER_MIME_TYPE}'`,
      fields: "nextPageToken,files(id,name,mimeType,driveId)",
      pageSize: String(PAGE_SIZE),
      orderBy: "name_natural",
      spaces: "drive",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    };
    if (pageToken) params.pageToken = pageToken;
    const payload = (await fetchDriveJson(
      driveApiUrl("/files", params),
      accessToken,
      signal,
    )) as DriveListPayload;
    if (Array.isArray(payload.files)) {
      folders.push(
        ...payload.files
        .map(parseFolder)
        .filter((folder): folder is DriveFolder => folder !== null),
      );
    }
    const nextPageToken =
      typeof payload.nextPageToken === "string" && payload.nextPageToken
        ? payload.nextPageToken
        : undefined;
    if (!nextPageToken) return folders;
    if (seenTokens.has(nextPageToken)) {
      throw new Error("Google Drive repeated a shared-folder page token");
    }
    seenTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }
  throw new Error("Google Drive shared-folder listing exceeded the page limit");
}

async function loadSharedDrives(
  accessToken: string,
  signal: AbortSignal,
): Promise<DriveFolder[]> {
  const drives: DriveFolder[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const params: Record<string, string> = {
      fields: "nextPageToken,drives(id,name)",
      pageSize: "100",
    };
    if (pageToken) params.pageToken = pageToken;
    const payload = (await fetchDriveJson(
      driveApiUrl("/drives", params),
      accessToken,
      signal,
    )) as SharedDrivePayload;
    if (Array.isArray(payload.drives)) {
      drives.push(
        ...payload.drives
        .map(parseSharedDrive)
        .filter((drive): drive is DriveFolder => drive !== null),
      );
    }
    const nextPageToken =
      typeof payload.nextPageToken === "string" && payload.nextPageToken
        ? payload.nextPageToken
        : undefined;
    if (!nextPageToken) return drives;
    if (seenTokens.has(nextPageToken)) {
      throw new Error("Google Drive repeated a shared-drive page token");
    }
    seenTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }
  throw new Error("Google Drive shared-drive listing exceeded the page limit");
}

function GoogleDriveFolderPickerDialog({
  accessToken,
  onSelect,
  onCancel,
  onFatalError,
}: {
  accessToken: string;
  onSelect: (folder: DriveFolder) => void;
  onCancel: () => void;
  onFatalError: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestEpochRef = useRef(0);
  const [current, setCurrent] = useState<DriveFolder | null>(null);
  const [path, setPath] = useState<DriveFolder[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [sharedFolders, setSharedFolders] = useState<DriveFolder[]>([]);
  const [sharedDrives, setSharedDrives] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();
    const controller = new AbortController();
    requestRef.current = controller;
    const epoch = ++requestEpochRef.current;
    void (async () => {
      try {
        const root = await loadRootFolder(accessToken, controller.signal);
        if (controller.signal.aborted || epoch !== requestEpochRef.current) {
          return;
        }
        setCurrent(root);
        setPath([root]);
        const [children, shared, drives] = await Promise.allSettled([
          loadFolderChildren(root, accessToken, controller.signal),
          loadSharedFolders(accessToken, controller.signal),
          loadSharedDrives(accessToken, controller.signal),
        ]);
        if (controller.signal.aborted || epoch !== requestEpochRef.current) {
          return;
        }
        if (children.status === "fulfilled") setFolders(children.value);
        else {
          setError(
            "Не удалось загрузить вложенные папки. Текущую папку всё равно можно выбрать.",
          );
        }
        if (shared.status === "fulfilled") setSharedFolders(shared.value);
        if (drives.status === "fulfilled") setSharedDrives(drives.value);
        setLoading(false);
      } catch (reason) {
        if (
          controller.signal.aborted ||
          epoch !== requestEpochRef.current ||
          (reason instanceof DOMException && reason.name === "AbortError")
        ) {
          return;
        }
        onFatalError();
      }
    })();
    return () => {
      controller.abort();
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus();
    };
  }, [accessToken, onFatalError]);

  const visitFolder = (folder: DriveFolder, nextPath: DriveFolder[]) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const epoch = ++requestEpochRef.current;
    setCurrent(folder);
    setPath(nextPath);
    setFolders([]);
    setError("");
    setLoading(true);
    void loadFolderChildren(folder, accessToken, controller.signal).then(
      (children) => {
        if (controller.signal.aborted || epoch !== requestEpochRef.current) {
          return;
        }
        setFolders(children);
        setLoading(false);
      },
      (reason) => {
        if (
          controller.signal.aborted ||
          epoch !== requestEpochRef.current ||
          (reason instanceof DOMException && reason.name === "AbortError")
        ) {
          return;
        }
        setError(
          "Не удалось загрузить вложенные папки. Текущую папку всё равно можно выбрать.",
        );
        setLoading(false);
      },
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (controls.length === 0) {
      event.preventDefault();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const atRoot = path.length === 1;
  const hasVisibleFolders =
    folders.length > 0 ||
    (atRoot && (sharedFolders.length > 0 || sharedDrives.length > 0));

  const renderFolderButton = (
    folder: DriveFolder,
    nextPath: DriveFolder[],
    keyPrefix: string,
  ) => (
    <li key={`${keyPrefix}:${folder.id}`}>
      <button
        type="button"
        className="google-drive-folder-row"
        onClick={() => visitFolder(folder, nextPath)}
        aria-label={`Открыть папку «${folder.name}»`}
      >
        <span aria-hidden="true">📁</span>
        <span>{folder.name}</span>
      </button>
    </li>
  );

  return (
    <div className="confirm-clear-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="card google-drive-folder-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={loading || undefined}
        data-studio-scroll-lock-allow="true"
        onKeyDown={handleKeyDown}
      >
        <header className="google-drive-folder-picker-header">
          <div>
            <h2 id={titleId}>Выберите папку для результатов</h2>
            <p id={descriptionId}>
              Откройте нужную папку и подтвердите текущую папку кнопкой ниже.
            </p>
          </div>
          <button
            ref={cancelRef}
            type="button"
            className="secondary"
            onClick={onCancel}
            aria-label="Закрыть выбор папки"
          >
            Закрыть
          </button>
        </header>

        <nav className="google-drive-folder-breadcrumbs" aria-label="Путь">
          {path.map((folder, index) => (
            <button
              type="button"
              key={`${folder.id}:${index}`}
              className="secondary"
              aria-current={index === path.length - 1 ? "page" : undefined}
              disabled={index === path.length - 1}
              onClick={() => visitFolder(folder, path.slice(0, index + 1))}
            >
              {folder.name}
            </button>
          ))}
        </nav>

        <div className="google-drive-folder-picker-content">
          {loading && <p role="status">Загружаем папки Google Drive…</p>}
          {error && <p role="alert">{error}</p>}
          {!loading && !hasVisibleFolders && (
            <p className="notice">
              Внутри нет папок. Текущую папку можно выбрать.
            </p>
          )}
          {folders.length > 0 && (
            <section aria-labelledby={`${titleId}-folders`}>
              <h3 id={`${titleId}-folders`}>Папки</h3>
              <ul className="google-drive-folder-list">
                {folders.map((folder) =>
                  renderFolderButton(folder, [...path, folder], "folder"),
                )}
              </ul>
            </section>
          )}
          {atRoot && sharedDrives.length > 0 && (
            <section aria-labelledby={`${titleId}-drives`}>
              <h3 id={`${titleId}-drives`}>Общие диски</h3>
              <ul className="google-drive-folder-list">
                {sharedDrives.map((folder) =>
                  renderFolderButton(folder, [folder], "drive"),
                )}
              </ul>
            </section>
          )}
          {atRoot && sharedFolders.length > 0 && (
            <section aria-labelledby={`${titleId}-shared`}>
              <h3 id={`${titleId}-shared`}>Доступные мне папки</h3>
              <ul className="google-drive-folder-list">
                {sharedFolders.map((folder) =>
                  renderFolderButton(folder, [folder], "shared"),
                )}
              </ul>
            </section>
          )}
        </div>

        <footer className="actions google-drive-folder-picker-actions">
          <button
            type="button"
            className="primary"
            disabled={current === null}
            onClick={() => current && onSelect(current)}
          >
            Выбрать эту папку
          </button>
          <span className="muted">
            {current ? `Текущая папка: ${current.name}` : "Загрузка…"}
          </span>
        </footer>
      </section>
    </div>
  );
}

export function openGoogleDriveFolderPicker(
  session: PickerSession,
): Promise<PickerResult> {
  let token = session.access_token;
  session.access_token = "";
  if (!token.trim()) {
    token = "";
    return Promise.resolve({
      action: "error",
      message: "Google Picker недоступен",
    });
  }
  const host = document.createElement("div");
  host.dataset.studioGoogleDriveFolderPicker = "true";
  document.body.appendChild(host);
  const root = createRoot(host);
  const releaseDocumentScroll = lockDocumentScroll();

  return new Promise((resolve) => {
    let completed = false;
    const finish = (result: PickerResult) => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeout);
      queueMicrotask(() => {
        root.unmount();
        host.remove();
        releaseDocumentScroll();
        token = "";
        resolve(result);
      });
    };
    const timeout = window.setTimeout(
      () =>
        finish({
          action: "error",
          message: "Время выбора папки Google Drive истекло. Повторите попытку.",
        }),
      INTERACTION_TIMEOUT_MS,
    );
    root.render(
      <GoogleDriveFolderPickerDialog
        accessToken={token}
        onSelect={(folder) =>
          finish({
            action: "picked",
            docs: [
              {
                id: folder.id,
                name: folder.name,
                mimeType: FOLDER_MIME_TYPE,
              },
            ],
          })
        }
        onCancel={() => finish({ action: "cancel" })}
        onFatalError={() =>
          finish({
            action: "error",
            message:
              "Не удалось загрузить папки Google Drive. Переподключите Drive или повторите попытку.",
          })
        }
      />,
    );
  });
}
