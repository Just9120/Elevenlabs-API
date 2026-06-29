export type Segment = { id: string; title: string; end: string };
export type SegmentView = { index: number; start: string; endLabel: string; title: string; error?: string };

export function parseTimeToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const parts = trimmed.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function buildSegmentPlan(segments: Segment[]): SegmentView[] {
  let startSeconds = 0;
  return segments.map((segment, idx) => {
    const isFinal = idx === segments.length - 1;
    const start = formatTime(startSeconds);
    if (isFinal) return { index: idx + 1, start, endLabel: 'До конца записи', title: segment.title || `Часть ${idx + 1}` };
    const endSeconds = parseTimeToSeconds(segment.end);
    let error: string | undefined;
    if (endSeconds === null) error = 'Укажите конец в формате MM:SS или HH:MM:SS.';
    else if (endSeconds <= startSeconds) error = 'Конец части должен быть позже её начала.';
    const endLabel = segment.end || 'Не задано';
    if (endSeconds !== null && endSeconds > startSeconds) startSeconds = endSeconds;
    return { index: idx + 1, start, endLabel, title: segment.title || `Часть ${idx + 1}`, error };
  });
}

export function hasSegmentErrors(segments: Segment[]): boolean {
  return buildSegmentPlan(segments).some((part) => Boolean(part.error));
}
