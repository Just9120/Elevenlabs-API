import { describe, expect, it, vi } from "vitest";
import {
  makeRealtimeDraft,
  newestRealtimeDraft,
  parseLatestRealtimeDraftResponse,
  realtimeDraftDownloadText,
} from "./realtimeDrafts";


describe("realtime draft contract", () => {
  it("preserves validated timing and speaker metadata in local/server recovery contracts", () => {
    const metadata = [{ id: "capture.0", start_seconds: 2, end_seconds: 4, speaker: 3 }];
    const draft = makeRealtimeDraft({ ownerUserId: "owner", projectId: "project", clientSessionId: "session_123456789",
      revision: 1, committedSegments: ["Реплика"], segmentMetadata: metadata, partial: "" });
    metadata[0].end_seconds = 9;
    expect(draft.segment_metadata?.[0]?.end_seconds).toBe(4);
    const { owner_user_id, project_id, ...payload } = draft;
    expect([owner_user_id, project_id]).toEqual(["owner", "project"]);
    expect(parseLatestRealtimeDraftResponse({ draft: payload }, "owner", "project")?.segment_metadata).toEqual(draft.segment_metadata);
    expect(parseLatestRealtimeDraftResponse({ draft: { ...payload, segment_metadata: [{ id: "capture.0", end_seconds: 4 }] } }, "owner", "project")).toBeUndefined();
  });
  it("creates a bounded owner/project draft retained until explicit clear", () => {
    const now = new Date("2026-08-22T12:00:00Z");
    const draft = makeRealtimeDraft({
      ownerUserId: "owner@example.test",
      projectId: "project-1",
      clientSessionId: "session_123456789",
      revision: 2,
      committedSegments: ["Первый", "Второй"],
      partial: "предварительно",
      now,
    });

    expect(draft).toMatchObject({
      owner_user_id: "owner@example.test",
      project_id: "project-1",
      client_session_id: "session_123456789",
      revision: 2,
      committed_segments: ["Первый", "Второй"],
      partial: "предварительно",
      updated_at: now.toISOString(),
    });
    expect(draft.expires_at).toBeNull();
  });

  it("fails closed on oversized or malformed transcript payloads", () => {
    expect(() =>
      makeRealtimeDraft({
        ownerUserId: "owner@example.test",
        projectId: "project-1",
        clientSessionId: "short",
        revision: 1,
        committedSegments: ["text"],
        partial: "",
      }),
    ).toThrow("invalid_realtime_draft");
    expect(() =>
      makeRealtimeDraft({
        ownerUserId: "owner@example.test",
        projectId: "project-1",
        clientSessionId: "session_123456789",
        revision: 1,
        committedSegments: ["x".repeat(20_001)],
        partial: "",
      }),
    ).toThrow("invalid_realtime_draft");
  });

  it("preserves valid legacy drafts beyond former expiry and rejects unknown fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00Z"));
    const response = {
      draft: {
        client_session_id: "session_123456789",
        revision: 3,
        committed_segments: ["Восстановленный текст"],
        partial: "ещё не подтверждено",
        updated_at: "2026-08-22T11:59:00Z",
        expires_at: "2026-08-25T11:59:00Z",
      },
    };
    expect(
      parseLatestRealtimeDraftResponse(
        response,
        "owner@example.test",
        "project-1",
      ),
    ).toMatchObject({
      owner_user_id: "owner@example.test",
      project_id: "project-1",
      revision: 3,
    });
    expect(
      parseLatestRealtimeDraftResponse(
        { draft: { ...response.draft, raw_audio: "forbidden" } },
        "owner@example.test",
        "project-1",
      ),
    ).toBeUndefined();
    expect(
      parseLatestRealtimeDraftResponse(
        { draft: { ...response.draft, expires_at: "2026-08-22T11:00:00Z" } },
        "owner@example.test",
        "project-1",
      ),
    ).toMatchObject({ revision: 3, committed_segments: ["Восстановленный текст"] });
    vi.setSystemTime(new Date("2027-08-22T12:00:00Z"));
    expect(parseLatestRealtimeDraftResponse(
      { draft: { ...response.draft, expires_at: null } },
      "owner@example.test", "project-1",
    )).toMatchObject({ expires_at: null, revision: 3 });
    expect(parseLatestRealtimeDraftResponse(
      { draft: { ...response.draft, expires_at: "invalid" } },
      "owner@example.test", "project-1",
    )).toBeUndefined();
    vi.useRealTimers();
  });

  it("selects the newest checkpoint and marks partial text in downloads", () => {
    const local = makeRealtimeDraft({
      ownerUserId: "owner@example.test",
      projectId: "project-1",
      clientSessionId: "session_123456789",
      revision: 4,
      committedSegments: ["Локальный"],
      partial: "",
      now: new Date("2026-08-22T12:02:00Z"),
    });
    const server = makeRealtimeDraft({
      ownerUserId: "owner@example.test",
      projectId: "project-1",
      clientSessionId: "session_987654321",
      revision: 5,
      committedSegments: ["Серверный"],
      partial: "не подтверждён",
      now: new Date("2026-08-22T12:01:00Z"),
    });

    expect(newestRealtimeDraft(local, server)).toBe(local);
    expect(realtimeDraftDownloadText(server)).toBe(
      "Серверный\n\n[Неподтверждённый фрагмент]\nне подтверждён",
    );
  });

  it("uses monotonic revision before clocks for one client session", () => {
    const local = makeRealtimeDraft({
      ownerUserId: "owner@example.test",
      projectId: "project-1",
      clientSessionId: "session_123456789",
      revision: 4,
      committedSegments: ["Устаревший локальный"],
      partial: "",
      now: new Date("2026-08-22T12:05:00Z"),
    });
    const server = makeRealtimeDraft({
      ownerUserId: "owner@example.test",
      projectId: "project-1",
      clientSessionId: "session_123456789",
      revision: 5,
      committedSegments: ["Новый серверный"],
      partial: "",
      now: new Date("2026-08-22T12:01:00Z"),
    });

    expect(newestRealtimeDraft(local, server)).toBe(server);
  });
});
