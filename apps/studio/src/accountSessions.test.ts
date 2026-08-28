import { describe, expect, it } from "vitest";
import {
  parseActiveSessionsResponse,
  parseRevokeOtherResponse,
  parseTargetedRevokeResponse,
  revokeOtherIsConfirmed,
  targetedRevokeIsConfirmed,
} from "./accountSessions";


const current = {
  id: "00000000-0000-0000-0000-000000000001",
  is_current: true,
  created_at: "2026-08-27T10:00:00+00:00",
  last_seen_at: "2026-08-27T10:05:00+00:00",
  expires_at: "2026-09-10T10:00:00+00:00",
};
const other = {
  ...current,
  id: "00000000-0000-0000-0000-000000000002",
  is_current: false,
};

describe("active session contracts", () => {
  it("accepts only a bounded current-first safe collection", () => {
    const parsed = parseActiveSessionsResponse({
      sessions: [current, other],
      truncated: false,
      limit: 100,
    });
    expect(parsed?.sessions).toEqual([current, other]);
    expect(targetedRevokeIsConfirmed(parsed!, other.id)).toBe(false);
    expect(revokeOtherIsConfirmed(parsed!)).toBe(false);
    expect(
      revokeOtherIsConfirmed({ ...parsed!, sessions: [current] }),
    ).toBe(true);
  });

  it("fails closed for credential data, duplicate ids and invalid authority", () => {
    expect(
      parseActiveSessionsResponse({
        sessions: [{ ...current, token_hash: "must-not-cross-boundary" }],
        truncated: false,
        limit: 100,
      }),
    ).toBeNull();
    expect(
      parseActiveSessionsResponse({
        sessions: [current, current],
        truncated: false,
        limit: 100,
      }),
    ).toBeNull();
    expect(
      parseActiveSessionsResponse({
        sessions: [{ ...current, is_current: false }],
        truncated: false,
        limit: 100,
      }),
    ).toBeNull();
  });

  it("validates mutation responses without accepting extra fields", () => {
    expect(
      parseTargetedRevokeResponse({ revoked: true, active: false }),
    ).toEqual({ revoked: true, active: false });
    expect(
      parseTargetedRevokeResponse({
        revoked: true,
        active: false,
        session_token: "unsafe",
      }),
    ).toBeNull();
    expect(parseRevokeOtherResponse({ revoked: 3 })).toEqual({ revoked: 3 });
    expect(parseRevokeOtherResponse({ revoked: -1 })).toBeNull();
  });
});
