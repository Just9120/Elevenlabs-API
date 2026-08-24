import { describe, expect, it } from "vitest";
import {
  parseSpeakerProfile,
  parseSpeakerProfileCollection,
} from "./speakerIdentityContracts";

const profile = {
  id: "profile-safe",
  display_name: "Анна",
  role: "Автор",
  active: true,
  created_at: "2026-08-24T18:00:00Z",
  updated_at: "2026-08-24T18:00:00Z",
};

describe("speaker identity contracts", () => {
  it("reconstructs safe profile fields and drops private extras", () => {
    expect(
      parseSpeakerProfile({
        ...profile,
        normalized_name: "private-normalized-name",
        owner_user_id: "private-owner",
      }),
    ).toEqual(profile);
  });

  it("rejects inactive, duplicate, and malformed collection rows", () => {
    expect(parseSpeakerProfileCollection({ profiles: [profile] })).toEqual([
      profile,
    ]);
    expect(
      parseSpeakerProfileCollection({
        profiles: [{ ...profile, active: false }],
      }),
    ).toBeNull();
    expect(
      parseSpeakerProfileCollection({ profiles: [profile, profile] }),
    ).toBeNull();
    expect(
      parseSpeakerProfileCollection({
        profiles: [{ ...profile, role: "" }],
      }),
    ).toBeNull();
  });
});
