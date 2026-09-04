import { describe, expect, it } from "vitest";
import {
  distinctBatchModes,
  parseSttDictionaryCollection,
  parseSttProviderCatalog,
  sttModeExplanation,
} from "./sttContracts";

describe("STT browser contracts", () => {
  it("accepts provider mode metadata with limits and health", () => {
    const value = {
      providers: [
        {
          provider: "yandex",
          display_name: "Yandex SpeechKit",
          byok_enabled: true,
          modes: [
            {
              mode: "realtime",
              model: "general",
              transport: "grpc_relay",
              languages: ["ru", "en", "detect"],
              diarization: true,
              dictionaries: false,
              file_constraints: {
                max_bytes: 10_485_760,
                max_duration_seconds: 300,
                audio_channels: [1],
              },
              health: {
                available: true,
                consecutive_failures: 0,
                retry_after_seconds: null,
              },
            },
          ],
        },
      ],
    };
    expect(parseSttProviderCatalog(value)).toEqual(value.providers);
    expect(
      parseSttProviderCatalog({
        providers: [
          {
            ...value.providers[0],
            modes: [{ ...value.providers[0].modes[0], transport: "unsafe" }],
          },
        ],
      }),
    ).toBeNull();
    expect(
      parseSttProviderCatalog({
        providers: [value.providers[0], value.providers[0]],
      }),
    ).toBeNull();
    expect(
      parseSttProviderCatalog({
        providers: [
          {
            ...value.providers[0],
            modes: [
              value.providers[0].modes[0],
              value.providers[0].modes[0],
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("accepts owner dictionaries and rejects unknown entry kinds", () => {
    const value = {
      dictionaries: [
        {
          id: "dictionary-1",
          name: "Проект",
          active: true,
          entries: [
            { kind: "term", value: "VoiceOps" },
            { kind: "abbreviation", value: "API" },
          ],
          updated_at: "2026-09-03T00:00:00Z",
        },
      ],
    };
    expect(parseSttDictionaryCollection(value)).toEqual(value.dictionaries);
    expect(
      parseSttDictionaryCollection({
        dictionaries: [
          {
            ...value.dictionaries[0],
            entries: [{ kind: "secret", value: "unsafe" }],
          },
        ],
      }),
    ).toBeNull();
  });

  it("collapses names that have the same effective provider capability", () => {
    const base = {
      model: "scribe_v2",
      transport: "batch" as const,
      languages: ["ru", "en", "detect"] as const,
      diarization: true,
      dictionaries: true,
      file_constraints: {
        max_bytes: 500,
        max_duration_seconds: 3600,
        audio_channels: [1, 2],
      },
      health: { available: true, consecutive_failures: 0, retry_after_seconds: null },
    };
    const modes = distinctBatchModes([
      { ...base, mode: "economic" },
      { ...base, mode: "standard" },
      { ...base, mode: "premium" },
    ]);
    expect(modes.map((mode) => mode.mode)).toEqual(["standard"]);
    expect(sttModeExplanation(modes[0])).toContain("до 60 мин.");

    const healthyEquivalent = distinctBatchModes([
      {
        ...base,
        mode: "standard",
        health: {
          available: false,
          consecutive_failures: 3,
          retry_after_seconds: 30,
        },
      },
      { ...base, mode: "economic" },
    ]);
    expect(healthyEquivalent.map((mode) => mode.mode)).toEqual(["economic"]);
  });
});
