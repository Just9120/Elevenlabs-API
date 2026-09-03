import { describe, expect, it, vi } from "vitest";
import {
  deliverRealtimeConsumer,
  makeRealtimeCaptionMessage,
  parseRealtimeCaptionMessage,
} from "./realtimeConsumers";
import { api } from "./apiClient";

vi.mock("./apiClient", () => ({
  api: vi.fn(),
  mutateWithCsrfRetry: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("realtime consumers", () => {
  it("bounds an overlay message to the latest three committed segments", () => {
    const message = makeRealtimeCaptionMessage(
      "project-1",
      ["one", "two", "three", "four"],
      "partial",
    );
    expect(message.committed).toEqual(["two", "three", "four"]);
    expect(parseRealtimeCaptionMessage(message)).toEqual(message);
    expect(parseRealtimeCaptionMessage({ ...message, committed: [1] })).toBeNull();
  });

  it("sends one consumer independently with no endpoint persistence", async () => {
    await deliverRealtimeConsumer(
      "project-1",
      "webhook",
      "https://captions.example/live",
      "Ready",
      3,
      "csrf",
      vi.fn(),
    );
    expect(api).not.toHaveBeenCalled();
  });
});
