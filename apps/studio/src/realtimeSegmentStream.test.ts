import { describe, expect, it } from "vitest";
import { RealtimeSegmentStream } from "./realtimeSegmentStream";

describe("Live provider stream correlation", () => {
  it("carries one capture identity through separate transports", () => {
    const sessionId = "capture_session_123456";
    const event = { kind: "committed" as const, text: "фрагмент", metadata: { id: "index.0", start_seconds: 0, end_seconds: 1 } };
    for (const transport of [1, 2]) {
      expect(new RealtimeSegmentStream(`namespace.${transport}`, transport * 10, sessionId).committed(event)?.metadata)
        .toMatchObject({ session_id: sessionId, start_seconds: transport * 10 });
    }
  });
  it("adds delayed timestamps once without losing identical spoken repetitions", () => {
    const stream = new RealtimeSegmentStream("session.1", 20);
    const first = stream.committed({ kind: "committed", text: "да" });
    const second = stream.committed({ kind: "committed", text: "да" });
    const event = { kind: "committed" as const, text: "да", timestampUpdate: true, metadata: { id: "timed", start_seconds: 1, end_seconds: 2 } };
    expect(stream.committed(event)).toEqual({ text: "да", metadata: { id: first!.metadata.id, start_seconds: 21, end_seconds: 22 }, replaces: true });
    expect(stream.committed(event)).toBeNull();
    expect(stream.committed({ ...event, metadata: { ...event.metadata, start_seconds: 3, end_seconds: 4 } })?.metadata.id).toBe(second!.metadata.id);
    expect(first!.metadata.id).not.toBe(second!.metadata.id);
  });

  it("deduplicates indexed finals and preserves refinements with the same identity", () => {
    const stream = new RealtimeSegmentStream("session.2", 50);
    const event = { kind: "committed" as const, text: "первая версия", metadata: { id: "index.0", start_seconds: 0, end_seconds: 1 } };
    expect(stream.committed(event)?.metadata).toMatchObject({ id: "session.2.index.0", start_seconds: 50, end_seconds: 51 });
    expect(stream.committed(event)).toBeNull();
    expect(stream.committed({ ...event, text: "исправление" })).toMatchObject({ text: "исправление", metadata: { id: "session.2.index.0" } });
    expect(new RealtimeSegmentStream("session.3", 60).committed(event)?.metadata.id).toBe("session.3.index.0");
  });
});
