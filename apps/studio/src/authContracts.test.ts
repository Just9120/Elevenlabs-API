import { describe, expect, it } from "vitest";
import { parseAuthenticatedSessionResponse } from "./authContracts";

describe("authenticated user accent contract", () => {
  it("accepts a supported server accent", () => {
    expect(
      parseAuthenticatedSessionResponse({
        authenticated: true,
        user: {
          email: "owner@example.com",
          role: "admin",
          accent_color: "teal",
        },
      }),
    ).toEqual({
      email: "owner@example.com",
      role: "admin",
      accent_color: "teal",
    });
  });

  it("fails closed when the server returns an unsupported accent", () => {
    expect(
      parseAuthenticatedSessionResponse({
        authenticated: true,
        user: {
          email: "owner@example.com",
          role: "admin",
          accent_color: "url(javascript:unsafe)",
        },
      }),
    ).toBeNull();
  });
});
