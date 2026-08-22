const DATABASE_NAME = "studio-realtime-recovery";
const DATABASE_VERSION = 1;
const STORE_NAME = "drafts";
export const REALTIME_DRAFT_TTL_MS = 72 * 60 * 60 * 1000;
export const REALTIME_PARTIAL_CHECKPOINT_DEBOUNCE_MS = 750;

const MAX_SEGMENTS = 5_000;
const MAX_COMMITTED_CHARACTERS = 500_000;
const MAX_PARTIAL_CHARACTERS = 20_000;
const CLIENT_SESSION_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export type RealtimeDraft = {
  owner_user_id: string;
  project_id: string;
  client_session_id: string;
  revision: number;
  committed_segments: string[];
  partial: string;
  updated_at: string;
  expires_at: string;
};

type StoredRealtimeDraft = RealtimeDraft & { key: string };

function draftKey(ownerUserId: string, projectId: string) {
  return `${ownerUserId}:${projectId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("indexeddb_request_failed")),
      { once: true },
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("indexeddb_transaction_aborted")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("indexeddb_transaction_failed")),
      { once: true },
    );
  });
}

async function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener("upgradeneeded", () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: "key" });
    }
  });
  return requestResult(request);
}

function isDraftShape(
  candidate: unknown,
  ownerUserId: string,
  projectId: string,
): candidate is RealtimeDraft {
  if (!candidate || typeof candidate !== "object") return false;
  const draft = candidate as Partial<RealtimeDraft>;
  if (
    draft.owner_user_id !== ownerUserId ||
    draft.project_id !== projectId ||
    typeof draft.client_session_id !== "string" ||
    !CLIENT_SESSION_PATTERN.test(draft.client_session_id) ||
    !Number.isInteger(draft.revision) ||
    (draft.revision as number) < 1 ||
    (draft.revision as number) > 2_147_483_647 ||
    !Array.isArray(draft.committed_segments) ||
    draft.committed_segments.length > MAX_SEGMENTS ||
    typeof draft.partial !== "string" ||
    draft.partial.length > MAX_PARTIAL_CHARACTERS ||
    typeof draft.updated_at !== "string" ||
    !Number.isFinite(Date.parse(draft.updated_at)) ||
    typeof draft.expires_at !== "string" ||
    !Number.isFinite(Date.parse(draft.expires_at))
  ) {
    return false;
  }
  let characterCount = 0;
  for (const segment of draft.committed_segments) {
    if (
      typeof segment !== "string" ||
      segment.length === 0 ||
      segment.length > MAX_PARTIAL_CHARACTERS
    ) {
      return false;
    }
    characterCount += segment.length;
    if (characterCount > MAX_COMMITTED_CHARACTERS) return false;
  }
  return true;
}

export function newRealtimeClientSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `session_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function makeRealtimeDraft({
  ownerUserId,
  projectId,
  clientSessionId,
  revision,
  committedSegments,
  partial,
  now = new Date(),
}: {
  ownerUserId: string;
  projectId: string;
  clientSessionId: string;
  revision: number;
  committedSegments: string[];
  partial: string;
  now?: Date;
}): RealtimeDraft {
  const draft: RealtimeDraft = {
    owner_user_id: ownerUserId,
    project_id: projectId,
    client_session_id: clientSessionId,
    revision,
    committed_segments: [...committedSegments],
    partial,
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + REALTIME_DRAFT_TTL_MS).toISOString(),
  };
  if (!isDraftShape(draft, ownerUserId, projectId)) {
    throw new Error("invalid_realtime_draft");
  }
  return draft;
}

export async function saveLocalRealtimeDraft(draft: RealtimeDraft) {
  if (!isDraftShape(draft, draft.owner_user_id, draft.project_id)) {
    throw new Error("invalid_realtime_draft");
  }
  const database = await openDatabase();
  if (!database) throw new Error("indexeddb_unavailable");
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const key = draftKey(draft.owner_user_id, draft.project_id);
    const existing = await requestResult(store.get(key));
    if (
      isDraftShape(existing, draft.owner_user_id, draft.project_id) &&
      existing.revision > draft.revision
    ) {
      await completion;
      return;
    }
    if (
      isDraftShape(existing, draft.owner_user_id, draft.project_id) &&
      existing.revision === draft.revision
    ) {
      if (
        existing.client_session_id !== draft.client_session_id ||
        existing.partial !== draft.partial ||
        existing.committed_segments.length !== draft.committed_segments.length ||
        existing.committed_segments.some(
          (segment, index) => segment !== draft.committed_segments[index],
        )
      ) {
        transaction.abort();
        await completion.catch(() => undefined);
        throw new Error("realtime_draft_revision_conflict");
      }
      await completion;
      return;
    }
    store.put({
      ...draft,
      committed_segments: [...draft.committed_segments],
      key,
    } satisfies StoredRealtimeDraft);
    await completion;
  } finally {
    database.close();
  }
}

export async function loadLocalRealtimeDraft(
  ownerUserId: string,
  projectId: string,
  now = new Date(),
): Promise<RealtimeDraft | null> {
  const database = await openDatabase();
  if (!database) return null;
  try {
    const key = draftKey(ownerUserId, projectId);
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const candidate = await requestResult(store.get(key));
    if (
      !isDraftShape(candidate, ownerUserId, projectId) ||
      Date.parse(candidate.expires_at) <= now.getTime()
    ) {
      if (candidate !== undefined) store.delete(key);
      await completion;
      return null;
    }
    await completion;
    return {
      ...candidate,
      committed_segments: [...candidate.committed_segments],
    };
  } finally {
    database.close();
  }
}

export async function deleteLocalRealtimeDraft(
  ownerUserId: string,
  projectId: string,
) {
  const database = await openDatabase();
  if (!database) return;
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).delete(draftKey(ownerUserId, projectId));
    await completion;
  } finally {
    database.close();
  }
}

export function parseLatestRealtimeDraftResponse(
  candidate: unknown,
  ownerUserId: string,
  projectId: string,
): RealtimeDraft | null | undefined {
  if (!candidate || typeof candidate !== "object" || !("draft" in candidate)) {
    return undefined;
  }
  const rawDraft = (candidate as { draft?: unknown }).draft;
  if (rawDraft === null) return null;
  if (!rawDraft || typeof rawDraft !== "object") return undefined;
  const allowedKeys = new Set([
    "client_session_id",
    "revision",
    "committed_segments",
    "partial",
    "updated_at",
    "expires_at",
  ]);
  if (Object.keys(rawDraft).some((key) => !allowedKeys.has(key))) {
    return undefined;
  }
  const draft = {
    ...(rawDraft as Record<string, unknown>),
    owner_user_id: ownerUserId,
    project_id: projectId,
  };
  if (!isDraftShape(draft, ownerUserId, projectId)) return undefined;
  if (Date.parse(draft.expires_at) <= Date.now()) return null;
  return {
    ...draft,
    committed_segments: [...draft.committed_segments],
  };
}

export function newestRealtimeDraft(
  localDraft: RealtimeDraft | null,
  serverDraft: RealtimeDraft | null,
) {
  if (!localDraft) return serverDraft;
  if (!serverDraft) return localDraft;
  const localUpdated = Date.parse(localDraft.updated_at);
  const serverUpdated = Date.parse(serverDraft.updated_at);
  if (localUpdated !== serverUpdated) {
    return localUpdated > serverUpdated ? localDraft : serverDraft;
  }
  return localDraft.revision >= serverDraft.revision ? localDraft : serverDraft;
}

export function realtimeDraftDownloadText(draft: RealtimeDraft) {
  const committed = draft.committed_segments.join("\n");
  if (!draft.partial) return committed;
  const separator = committed ? "\n\n" : "";
  return `${committed}${separator}[Неподтверждённый фрагмент]\n${draft.partial}`;
}
