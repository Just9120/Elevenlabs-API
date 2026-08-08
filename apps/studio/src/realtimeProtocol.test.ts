import { describe, expect, it } from "vitest";
import {
  downsampleMono,
  floatToPcm16Base64,
  parseRealtimeCapability,
  parseRealtimeEvent,
  realtimeAudioMessage,
} from "./realtimeProtocol";

const capability = {
  websocket_url:
    "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=sutkn_test&audio_format=pcm_16000&commit_strategy=vad",
  expires_in_seconds: 900,
  model_id: "scribe_v2_realtime",
  audio_format: "pcm_16000",
  commit_strategy: "vad",
};

describe("realtime protocol", () => {
  it("accepts only the exact ElevenLabs websocket capability", () => {
    expect(parseRealtimeCapability(capability)).toEqual(capability);
    expect(() =>
      parseRealtimeCapability({
        ...capability,
        websocket_url: "wss://evil.example/realtime?token=private",
      }),
    ).toThrow(/небезопасный realtime-адрес/);
    expect(() =>
      parseRealtimeCapability({
        ...capability,
        websocket_url:
          "wss://api.elevenlabs.io:444/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&commit_strategy=vad&token=private",
      }),
    ).toThrow(/небезопасный realtime-адрес/);
    expect(() =>
      parseRealtimeCapability({
        ...capability,
        websocket_url:
          "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=other&audio_format=pcm_16000&commit_strategy=vad&token=private",
      }),
    ).toThrow(/небезопасный realtime-адрес/);
    expect(() =>
      parseRealtimeCapability({
        ...capability,
        websocket_url:
          "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&commit_strategy=vad&token=one&token=two",
      }),
    ).toThrow(/небезопасный realtime-адрес/);
    expect(() =>
      parseRealtimeCapability({
        ...capability,
        websocket_url:
          "ws://api.elevenlabs.io/v1/speech-to-text/realtime?token=private",
      }),
    ).toThrow(/небезопасный realtime-адрес/);
    expect(() =>
      parseRealtimeCapability({
        ...capability,
        websocket_url:
          "wss://api.elevenlabs.io/v1/speech-to-text/realtime",
      }),
    ).toThrow(/небезопасный realtime-адрес/);
  });

  it("reduces provider events to ordered transcript states", () => {
    expect(parseRealtimeEvent({ message_type: "session_started" })).toEqual({
      kind: "session_started",
    });
    expect(
      parseRealtimeEvent({
        message_type: "partial_transcript",
        text: " черновик ",
      }),
    ).toEqual({ kind: "partial", text: "черновик" });
    expect(
      parseRealtimeEvent({
        message_type: "committed_transcript",
        text: " готово ",
      }),
    ).toEqual({ kind: "committed", text: "готово" });
    expect(
      parseRealtimeEvent({
        message_type: "final_transcript",
        text: " финальный фрагмент ",
      }),
    ).toEqual({ kind: "committed", text: "финальный фрагмент" });
    expect(
      parseRealtimeEvent({ message_type: "error", error_code: "quota" }),
    ).toEqual({ kind: "error", code: "quota" });
    expect(parseRealtimeEvent({ message_type: "rate_limited" })).toEqual({
      kind: "error",
      code: "rate_limited",
    });
    expect(parseRealtimeEvent({ private: "ignored" })).toEqual({
      kind: "ignored",
    });
  });

  it("downsamples mono audio and encodes little-endian PCM16", () => {
    const input = new Float32Array(48);
    input.fill(0.5);
    const output = downsampleMono(input, 48_000, 16_000);
    expect(output).toHaveLength(16);
    expect([...output]).toEqual(new Array(16).fill(0.5));
    expect(floatToPcm16Base64(new Float32Array([-1, 0, 1]))).toBe(
      "AIAAAP9/",
    );
  });

  it("builds audio and explicit final commit messages without metadata", () => {
    expect(JSON.parse(realtimeAudioMessage("YWJj"))).toEqual({
      message_type: "input_audio_chunk",
      audio_base_64: "YWJj",
      sample_rate: 16_000,
    });
    expect(JSON.parse(realtimeAudioMessage("", true))).toEqual({
      message_type: "input_audio_chunk",
      audio_base_64: "",
      sample_rate: 16_000,
      commit: true,
    });
  });
});
