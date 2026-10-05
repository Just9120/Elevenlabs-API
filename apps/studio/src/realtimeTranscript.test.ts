import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { exportLiveTranscript, timedExportUnavailable, validSegmentMetadataList, upsertLiveSegment, liveExportSelection } from "./realtimeTranscript";

const input = {
  segments: ["Первая строка & <текст> 🧪", "Повторная реплика"], partial: "",
  metadata: [{ id: "session.0", start_seconds: 1.25, end_seconds: 3.5, speaker: 2 },
    { id: "session.1", start_seconds: 3601, end_seconds: 3602 }],
  title: "Лекция <без разметки>", startedAt: "2026-10-04T14:05:00+03:00",
};

describe("Live exports without provider access", () => {
  it("keeps independent capture clocks separate while exporting all text or a selected session", () => {
    const first = "capture_first_123456", second = "capture_second_123456";
    const mixed = { segments: ["старый текст", "новый текст"], partial: "ещё не подтверждено",
      metadata: [{ id: "old", session_id: first, start_seconds: 10, end_seconds: 11 },
        { id: "new", session_id: second, start_seconds: 1, end_seconds: 2 }] };
    expect(timedExportUnavailable({ ...mixed, partial: "" })).toContain("разным Live-сессиям");
    const whole = liveExportSelection(mixed, "");
    expect(strFromU8(exportLiveTranscript(whole, "txt").bytes)).toContain("старый текст\nновый текст");
    expect(whole.partial).toBe(mixed.partial);
    const selected = liveExportSelection(mixed, second);
    expect(strFromU8(exportLiveTranscript(selected, "srt").bytes)).toBe("1\n00:00:01,000 --> 00:00:02,000\nновый текст\n");
    expect(strFromU8(exportLiveTranscript(liveExportSelection(mixed, first), "vtt").bytes)).toContain("00:00:10.000");
    expect(mixed.partial).toBe("ещё не подтверждено");
    expect(liveExportSelection({ ...mixed, startedAt: input.startedAt }, "").startedAt).toBeUndefined();
    expect(liveExportSelection({ ...mixed, metadata: [null, mixed.metadata[1]], startedAt: input.startedAt }, "").startedAt).toBeUndefined();
    expect(timedExportUnavailable({ ...input, metadata: [input.metadata[1], input.metadata[0]] })).toContain("Порядок");
  });
  it("creates a self-contained safe DOCX with transcript_doc styles and known metadata", () => {
    const result = exportLiveTranscript(input, "docx");
    const files = unzipSync(result.bytes);
    expect(Object.keys(files)).toHaveLength(5);
    const parse = (path: string) => new DOMParser().parseFromString(strFromU8(files[path]), "application/xml");
    for (const path of Object.keys(files)) expect(parse(path).querySelector("parsererror")).toBeNull();
    const document = parse("word/document.xml");
    expect(document.documentElement.textContent).toContain("Первая строка & <текст> 🧪");
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    expect(document.getElementsByTagNameNS(ns, "pStyle")[0]?.getAttributeNS(ns, "val")).toBe("Heading2");
    const speaker = Array.from(document.getElementsByTagNameNS(ns, "p")).find((paragraph) => paragraph.textContent === "Спикер 2:");
    expect(speaker?.getElementsByTagNameNS(ns, "b").length).toBe(1);
    expect(speaker?.getElementsByTagNameNS(ns, "sz")[0]?.getAttributeNS(ns, "val")).toBe("28");
    expect(document.documentElement.textContent).toContain("Document standard: transcript_doc");
    expect(document.documentElement.textContent).toContain("Метаданные транскрипта");
    expect(document.documentElement.textContent).toContain("Транскрипция");
    expect(document.documentElement.textContent).toContain("Created at: 2026-10-04T11:05:00.000Z");
    expect(strFromU8(files["word/document.xml"])).not.toContain("<текст>");
  });

  it("exports real cue times without using session elapsed or download time", () => {
    const srt = strFromU8(exportLiveTranscript(input, "srt").bytes);
    expect(srt).toContain("00:00:01,250 --> 00:00:03,500\nСпикер 2:");
    expect(srt).toContain("01:00:01,000 --> 01:00:02,000");
    expect(srt).toContain("&lt;текст&gt;");
    expect(strFromU8(exportLiveTranscript(input, "vtt").bytes)).toMatch(/^WEBVTT\n\n1\n00:00:01\.250/);
  });

  it("preserves untimed, partial and gap text while rejecting misleading timed exports", () => {
    const restored = { segments: ["Сохранённый текст", "[Разрыв аудио]"], partial: "не готово" };
    expect(strFromU8(exportLiveTranscript(restored, "txt").bytes)).toContain("[Неподтверждённый фрагмент]\nне готово");
    expect(timedExportUnavailable(restored)).toContain("Неподтверждённый");
    expect(() => exportLiveTranscript(restored, "srt")).toThrow("таймкодов");
    const files = unzipSync(exportLiveTranscript(restored, "docx").bytes);
    expect(strFromU8(files["word/document.xml"])).not.toContain("Created at:");
    expect(strFromU8(exportLiveTranscript({ ...restored, segments: ["**не команда** <script>"] }, "md").bytes)).toContain("\\*\\*не команда\\*\\*");
  });

  it("rejects mismatched, duplicate, unsafe and fabricated timing metadata", () => {
    expect(validSegmentMetadataList([{ id: "x", start_seconds: -1, end_seconds: 2 }], 1)).toBe(false);
    expect(validSegmentMetadataList([{ id: "x", start_seconds: 1, end_seconds: Infinity }], 1)).toBe(false);
    expect(validSegmentMetadataList([{ id: "x" }, { id: "x" }], 2)).toBe(false);
    expect(validSegmentMetadataList([{ id: "x", speaker: 0 }], 1)).toBe(false);
    expect(validSegmentMetadataList([{ id: "x", raw_audio: "forbidden" }], 1)).toBe(false);
    expect(() => exportLiveTranscript({ segments: ["x"], metadata: [], partial: "" }, "docx")).toThrow("Некорректный");
    expect(() => exportLiveTranscript({ segments: ["x".repeat(500001)], partial: "" }, "md")).toThrow("Некорректный");
  });

  it("orders delayed indexed finals and replaces corrections without removing repeated speech", () => {
    let result = upsertLiveSegment([], [], "третья", { id: "session.1.index.2" });
    result = upsertLiveSegment(result.segments, result.metadata, "первая", { id: "session.1.index.0" });
    result = upsertLiveSegment(result.segments, result.metadata, "вторая", { id: "session.1.index.1" });
    result = upsertLiveSegment(result.segments, result.metadata, "исправленная", { id: "session.1.index.1", start_seconds: 2, end_seconds: 3 });
    expect(result.inserted).toBe(false);
    expect(result.segments).toEqual(["первая", "исправленная", "третья"]);
    result = upsertLiveSegment(result.segments, result.metadata, "первая", { id: "session.2.index.0" });
    result = upsertLiveSegment(result.segments, result.metadata, "первая");
    expect(result.segments).toEqual(["первая", "исправленная", "третья", "первая", "первая"]);
    expect(result.metadata[1]).toMatchObject({ start_seconds: 2, end_seconds: 3 });
  });
});
