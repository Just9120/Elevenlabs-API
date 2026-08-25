import { encodeWav, processDecodedPcm, processLocalAudioFiles, type LocalAudioOptions, type PcmAudio } from "./localAudioProcessing";

function options(overrides: Partial<LocalAudioOptions> = {}): LocalAudioOptions {
  return {
    operationMode: "concat",
    channelMode: "preserve",
    silenceEnabled: false,
    silenceThresholdDb: -45,
    silenceMinimumSeconds: 1,
    silenceKeepSeconds: 0.3,
    title: "Результат",
    ...overrides,
  };
}

function pcm(values: number[][], sampleRate = 10): PcmAudio {
  return { sampleRate, channels: values.map((channel) => Float32Array.from(channel)) };
}

describe("browser-local audio processing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("concatenates files in explicit order and preserves stereo", () => {
    const [result] = processDecodedPcm(
      [pcm([[0.1, 0.2], [0.3, 0.4]]), pcm([[0.5], [0.6]])],
      options(),
    );
    expect(result.channels[0][0]).toBeCloseTo(0.1);
    expect(result.channels[0][1]).toBeCloseTo(0.2);
    expect(result.channels[0][2]).toBeCloseTo(0.5);
    expect(result.channels[1][0]).toBeCloseTo(0.3);
    expect(result.channels[1][1]).toBeCloseTo(0.4);
    expect(result.channels[1][2]).toBeCloseTo(0.6);
  });

  it("removes only silence runs at or above the configured minimum", () => {
    const speech = 0.5;
    const [result] = processDecodedPcm(
      [pcm([[speech, ...Array(20).fill(0), speech]], 10)],
      options({ silenceEnabled: true, silenceMinimumSeconds: 1, silenceKeepSeconds: 0.2 }),
    );
    expect(result.channels[0].length).toBe(4);
    expect(result.channels[0][0]).toBeCloseTo(speech);
    expect(result.channels[0][3]).toBeCloseTo(speech);
  });

  it("mixes stereo to mono and emits a valid PCM WAV header", async () => {
    const [result] = processDecodedPcm([pcm([[1, -1], [-1, 1]], 48_000)], options({ channelMode: "mixdown" }));
    expect(result.channels).toHaveLength(1);
    expect(Array.from(result.channels[0])).toEqual([0, 0]);
    const blob = encodeWav(result);
    expect(blob.type).toBe("audio/wav");
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsArrayBuffer(blob);
    });
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(new DataView(bytes).getUint16(22, true)).toBe(1);
  });

  it("rejects a missing right channel instead of silently substituting", () => {
    expect(() => processDecodedPcm([pcm([[0.2]])], options({ channelMode: "right" }))).toThrow("local_audio_right_channel_unavailable");
  });

  it("keeps the orchestration browser-local and closes the decoder context", async () => {
    const close = vi.fn(async () => undefined);
    class FakeAudioContext {
      close = close;
      async decodeAudioData() {
        const channels = [Float32Array.from([0.2, -0.2])];
        return {
          length: 2,
          numberOfChannels: 1,
          sampleRate: 48_000,
          getChannelData: (index: number) => channels[index],
        } as AudioBuffer;
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const file = new File(["encoded"], "input.webm", { type: "audio/webm" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("encoded").buffer,
    });
    const progress: number[] = [];

    const results = await processLocalAudioFiles(
      [file],
      options({ operationMode: "separate", title: "Безопасный:результат" }),
      (value) => progress.push(value.percent),
    );

    expect(results).toHaveLength(1);
    expect(results[0].filename).toBe("Безопасный_результат.wav");
    expect(results[0].blob.type).toBe("audio/wav");
    expect(progress.at(-1)).toBe(100);
    expect(close).toHaveBeenCalledOnce();
  });
});
