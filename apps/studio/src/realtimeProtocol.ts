export type RealtimeCapability = {
  websocket_url: string;
  expires_in_seconds: number;
  model_id: "scribe_v2_realtime";
  audio_format: "pcm_16000";
  commit_strategy: "vad";
};

export type RealtimeTranscriptEvent =
  | { kind: "session_started" }
  | { kind: "partial"; text: string }
  | { kind: "committed"; text: string }
  | { kind: "error"; code: string }
  | { kind: "ignored" };

const REALTIME_HOST = "api.elevenlabs.io";
const REALTIME_PATH = "/v1/speech-to-text/realtime";

export function parseRealtimeCapability(value: unknown): RealtimeCapability {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Сервер вернул некорректную realtime-конфигурацию.");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.model_id !== "scribe_v2_realtime" ||
    candidate.audio_format !== "pcm_16000" ||
    candidate.commit_strategy !== "vad" ||
    !Number.isInteger(candidate.expires_in_seconds) ||
    (candidate.expires_in_seconds as number) < 1 ||
    (candidate.expires_in_seconds as number) > 900 ||
    typeof candidate.websocket_url !== "string"
  ) {
    throw new Error("Сервер вернул некорректную realtime-конфигурацию.");
  }
  let url: URL;
  try {
    url = new URL(candidate.websocket_url);
  } catch {
    throw new Error("Сервер вернул небезопасный realtime-адрес.");
  }
  if (
    url.protocol !== "wss:" ||
    url.hostname !== REALTIME_HOST ||
    url.pathname !== REALTIME_PATH ||
    Boolean(url.username) ||
    Boolean(url.password) ||
    Boolean(url.hash) ||
    !url.searchParams.get("token")
  ) {
    throw new Error("Сервер вернул небезопасный realtime-адрес.");
  }
  return candidate as RealtimeCapability;
}

function scalarText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseRealtimeEvent(value: unknown): RealtimeTranscriptEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { kind: "ignored" };
  }
  const data = value as Record<string, unknown>;
  const eventType = scalarText(
    data.message_type ?? data.type ?? data.event ?? data.status,
  ).toLowerCase();
  if (eventType.includes("session_started")) {
    return { kind: "session_started" };
  }
  if (eventType.includes("error") || data.error || data.error_code) {
    return {
      kind: "error",
      code:
        scalarText(data.error_code ?? data.code ?? data.error) ||
        "realtime_error",
    };
  }
  const text = scalarText(
    data.text ??
      data.transcript ??
      data.partial_transcript ??
      data.committed_transcript ??
      data.final_transcript,
  );
  if (!text) return { kind: "ignored" };
  if (eventType.includes("partial") || data.is_final === false) {
    return { kind: "partial", text };
  }
  if (
    eventType.includes("commit") ||
    eventType.includes("final") ||
    data.is_final === true
  ) {
    return { kind: "committed", text };
  }
  return { kind: "partial", text };
}

export function downsampleMono(
  input: Float32Array,
  inputRate: number,
  outputRate = 16_000,
) {
  if (!Number.isFinite(inputRate) || inputRate < outputRate) {
    throw new Error("Частота аудио не поддерживается realtime-клиентом.");
  }
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const result = new Float32Array(Math.round(input.length / ratio));
  let inputOffset = 0;
  for (let outputOffset = 0; outputOffset < result.length; outputOffset += 1) {
    const nextInputOffset = Math.round((outputOffset + 1) * ratio);
    let total = 0;
    let count = 0;
    for (
      let index = inputOffset;
      index < nextInputOffset && index < input.length;
      index += 1
    ) {
      total += input[index];
      count += 1;
    }
    result[outputOffset] = count ? total / count : 0;
    inputOffset = nextInputOffset;
  }
  return result;
}

export function floatToPcm16Base64(input: Float32Array) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function realtimeAudioMessage(audioBase64: string, commit = false) {
  return JSON.stringify({
    message_type: "input_audio_chunk",
    audio_base_64: audioBase64,
    sample_rate: 16_000,
    ...(commit ? { commit: true } : {}),
  });
}
