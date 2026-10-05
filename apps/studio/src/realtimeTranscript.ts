import { strToU8, zipSync } from "fflate";

export type RealtimeSegmentMetadata = {
  id: string;
  start_seconds?: number;
  end_seconds?: number;
  speaker?: number;
  gap?: boolean;
};

export type LiveExportFormat = "txt" | "md" | "docx" | "srt" | "vtt";
export const LIVE_EXPORT_FORMATS: LiveExportFormat[] = ["txt", "md", "docx", "srt", "vtt"];

/** Indexed provider corrections replace a final; delayed finals keep provider order.
 * Plain speech (including identical repetitions) and other transports stay distinct. */
export function upsertLiveSegment(segments: string[], metadata: (RealtimeSegmentMetadata | null)[], text: string, item?: RealtimeSegmentMetadata) {
  const next = [...segments], nextMetadata = [...metadata];
  const existing = item ? metadata.findIndex((value) => value?.id === item.id) : -1;
  if (existing >= 0) {
    next[existing] = text;
    nextMetadata[existing] = item!;
    return { segments: next, metadata: nextMetadata, inserted: false };
  }
  const order = item?.id.match(/^(.*\.index\.)(\d+)$/);
  const position = order ? metadata.findIndex((value) => {
    const candidate = value?.id.match(/^(.*\.index\.)(\d+)$/);
    return candidate?.[1] === order[1] && Number(candidate[2]) > Number(order[2]);
  }) : -1;
  const target = position >= 0 ? position : next.length;
  next.splice(target, 0, text);
  nextMetadata.splice(target, 0, item ?? null);
  return { segments: next, metadata: nextMetadata, inserted: true };
}

export function validSegmentMetadata(value: unknown): value is RealtimeSegmentMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["id", "start_seconds", "end_seconds", "speaker", "gap"].includes(key))) return false;
  if (typeof data.id !== "string" || !/^[A-Za-z0-9_.:-]{1,160}$/.test(data.id)) return false;
  if (data.gap !== undefined && typeof data.gap !== "boolean") return false;
  if (data.speaker !== undefined && (!Number.isInteger(data.speaker) || (data.speaker as number) < 1 || (data.speaker as number) > 1000)) return false;
  const start = data.start_seconds, end = data.end_seconds;
  if (start === undefined && end === undefined) return true;
  return typeof start === "number" && typeof end === "number" && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= 604800;
}

export function validSegmentMetadataList(value: unknown, length: number): value is (RealtimeSegmentMetadata | null)[] {
  if (!Array.isArray(value) || value.length !== length) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (item === null) return true;
    if (!validSegmentMetadata(item) || ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
}

export type LiveExportInput = {
  segments: string[];
  metadata?: (RealtimeSegmentMetadata | null)[];
  partial: string;
  title?: string;
  startedAt?: string;
};

export function timedExportUnavailable(input: LiveExportInput): string | null {
  if (input.partial) return "Неподтверждённый фрагмент ещё не имеет надёжных таймкодов. Сохраните TXT, Markdown или DOCX.";
  if (!input.segments.length || !validSegmentMetadataList(input.metadata, input.segments.length) ||
    input.metadata.some((item) => !item || item.start_seconds === undefined || item.end_seconds === undefined)) {
    return "Для этого текста нет полных таймкодов. Доступны TXT, Markdown и DOCX.";
  }
  return null;
}

function speakerLabel(item: RealtimeSegmentMetadata | null | undefined) {
  return item?.speaker === undefined ? "" : `Спикер ${item.speaker}:`;
}

function xml(value: string) {
  // XML 1.0 disallows controls; preserve all ordinary Unicode, including emoji.
  return Array.from(value).filter((character) => {
    const code = character.codePointAt(0)!;
    return (code >= 32 || code === 9 || code === 10 || code === 13) && code !== 0xFFFE && code !== 0xFFFF;
  }).join("")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function paragraph(text: string, kind: "body" | "title" | "speaker" = "body") {
  const style = kind === "title" ? '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' : "";
  const size = kind === "speaker" ? 28 : 22;
  return `<w:p>${style}<w:r><w:rPr>${kind === "speaker" ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

function docx(input: LiveExportInput, header: string[]) {
  const paragraphs = [paragraph(input.title || "Live-транскрибация", "title"), paragraph(""), paragraph("Метаданные транскрипта"), ...header.map((text) => paragraph(text)), paragraph(""), paragraph("Транскрипция"), paragraph("")];
  input.segments.forEach((text, index) => {
    const label = speakerLabel(input.metadata?.[index]);
    if (label) paragraphs.push(paragraph(label, "speaker"));
    for (const line of text.split(/\r?\n/)) paragraphs.push(paragraph(line));
  });
  if (input.partial) {
    paragraphs.push(paragraph("Неподтверждённый фрагмент", "speaker"));
    for (const line of input.partial.split(/\r?\n/)) paragraphs.push(paragraph(line));
  }
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  // Fixed package names: user text never controls ZIP paths, relations or markup.
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/_rels/document.xml.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${ns}"><w:body>${paragraphs.join("")}<w:sectPr/></w:body></w:document>`),
    "word/styles.xml": strToU8(`<?xml version="1.0"?><w:styles xmlns:w="${ns}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style></w:styles>`),
  }, { level: 1 });
}

function timestamp(seconds: number, separator: "," | ".") {
  const total = Math.round(seconds * 1000);
  return `${String(Math.floor(total / 3600000)).padStart(2, "0")}:${String(Math.floor(total / 60000) % 60).padStart(2, "0")}:${String(Math.floor(total / 1000) % 60).padStart(2, "0")}${separator}${String(total % 1000).padStart(3, "0")}`;
}

export function exportLiveTranscript(input: LiveExportInput, format: LiveExportFormat): { bytes: Uint8Array; mime: string } {
  if (!LIVE_EXPORT_FORMATS.includes(format) || input.segments.length > 5000 ||
    input.segments.some((text) => typeof text !== "string" || text.length > 20000) ||
    input.segments.reduce((total, text) => total + text.length, 0) > 500000 || input.partial.length > 20000 ||
    (input.metadata !== undefined && !validSegmentMetadataList(input.metadata, input.segments.length))) throw new Error("Некорректный Live-текст для экспорта.");
  const created = input.startedAt && Number.isFinite(Date.parse(input.startedAt)) ? new Date(input.startedAt).toISOString() : null;
  const header = ["Document standard: transcript_doc", ...(created ? [`Created at: ${created}`] : [])];
  if (format === "docx") return { bytes: docx(input, header), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  const separator = format === "srt" ? "," : ".";
  let text: string;
  if (format === "srt" || format === "vtt") {
    const unavailable = timedExportUnavailable(input);
    if (unavailable) throw new Error(unavailable);
    const cues = input.segments.map((segment, index) => {
      const item = input.metadata![index]!;
      // Plain caption text only: escape provider/user markup and cue separators.
      const caption = segment.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\r?\n\s*\r?\n/g, "\n");
      return `${index + 1}\n${timestamp(item.start_seconds!, separator)} --> ${timestamp(item.end_seconds!, separator)}\n${speakerLabel(item)}${item.speaker ? " " : ""}${caption}`;
    });
    text = `${format === "vtt" ? "WEBVTT\n\n" : ""}${cues.join("\n\n")}\n`;
  } else {
    const escapeMarkdown = (value: string) => value.replace(/[\\`*_{}[\]()#+.!<>]/g, "\\$&");
    const paragraphs = input.segments.map((segment, index) => {
      const label = speakerLabel(input.metadata?.[index]);
      return format === "md" ? `${label ? `**${label}**\n\n` : ""}${escapeMarkdown(segment)}` : `${label ? `${label}\n` : ""}${segment}`;
    });
    if (input.partial) paragraphs.push(`[Неподтверждённый фрагмент]\n${format === "md" ? escapeMarkdown(input.partial) : input.partial}`);
    text = format === "md" ? `## ${escapeMarkdown(input.title || "Live-транскрибация")}\n\n${header.join("\n\n")}\n\n${paragraphs.join("\n\n")}\n` : paragraphs.join("\n");
  }
  return { bytes: strToU8(text), mime: format === "vtt" ? "text/vtt;charset=utf-8" : "text/plain;charset=utf-8" };
}
