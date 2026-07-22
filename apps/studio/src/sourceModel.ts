export type Source = {
  id: string;
  project_id: string;
  source_type: "local_upload" | "google_drive";
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  drive_file_url: string | null;
  upload_status: "pending" | "uploaded" | "deleted" | "expired" | "failed";
  uploaded_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  created_at: string;
  updated_at: string;
};

export function isUsableJobSource(source: Source) {
  const expiresAt = source.expires_at
    ? new Date(source.expires_at).getTime()
    : null;
  return (
    source.upload_status === "uploaded" &&
    !source.deleted_at &&
    (expiresAt == null || expiresAt > Date.now()) &&
    (source.source_type === "google_drive" ||
      source.source_type === "local_upload")
  );
}

export function unusableJobSourceReason(source: Source) {
  if (source.deleted_at)
    return "Убранный из проекта файл нельзя добавить в задачу";
  if (source.expires_at && new Date(source.expires_at).getTime() <= Date.now())
    return "Срок хранения временной копии истёк";
  if (source.upload_status !== "uploaded")
    return "Файл ещё не готов для задачи";
  return "Тип файла не поддерживается для задачи";
}

export function sourceСтатусLabel(status: Source["upload_status"]) {
  const labels: Record<Source["upload_status"], string> = {
    pending: "Загружается",
    uploaded: "Готов",
    deleted: "Убран из проекта",
    expired: "Срок истёк",
    failed: "Ошибка",
  };
  return labels[status];
}
