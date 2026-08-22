import { describe, expect, it, vi } from "vitest";
import {
  REALTIME_DRAFT_TTL_MS,
  makeRealtimeDraft,
  newestRealtimeDraft,
  parseLatestRealtimeDraftResponse,
  realtimeDraftDownloadText,
} from "./realtimeDrafts";


describe("realtime draft contract", () => {
  it("creates a bounded owner/project draft with an exact 72-hour TTL", () => {
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
    expect(Date.parse(draft.expires_at) - now.getTime()).toBe(
      REALTIME_DRAFT_TTL_MS,
    );
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

  it("accepts only the authenticated scope and a non-expired server DTO", () => {
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
    ).toBeNull();
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
});
