import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AudioWaveform, parseAudioVisual, type AudioVisual } from "./AudioWaveform";
import { buildLocalAudioVisual, processDecodedPcm, type LocalAudioOptions } from "./localAudioProcessing";

const visual: AudioVisual = { removed_seconds: 2.5, sources: [{ position: 0, duration_seconds: 10, peaks: [0.8, 0, 0.5],
  silence_count: 1, silences: [{ start: 2, end: 5, removed_seconds: 2.5 }], intervals_truncated: false }] };

describe("audio waveform and pause comparison", () => {
  it("renders truthful duration, waveform and accessible interval details", async () => {
    render(<AudioWaveform visual={visual} before={10} after={7.5} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Найдено пауз: 1/);
    await userEvent.click(screen.getByText("Найденные паузы: 1"));
    expect(screen.getByText(/0:02–0:05/)).toBeVisible();
    expect(screen.getByText(/До: 0:10 · после сокращения: 0:07/)).toBeVisible();
  });

  it("handles no-silence and unavailable legacy metadata honestly", () => {
    const view = render(<AudioWaveform visual={{ removed_seconds: 0, sources: [{ ...visual.sources[0], silences: [], silence_count: 0 }] }} before={10} after={10} />);
    expect(screen.getByText("Пауз для сокращения не найдено.")).toBeVisible();
    view.rerender(<AudioWaveform visual={null} before={10} after={10} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Визуальная шкала недоступна для этой проверки.")).toBeVisible();
  });

  it("rejects nonfinite, oversized or impossible intervals rather than drawing fake data", () => {
    expect(parseAudioVisual({ ...visual, sources: [null] })).toBeNull();
    expect(parseAudioVisual({ ...visual, sources: [{ ...visual.sources[0], silences: [null] }] })).toBeNull();
    expect(parseAudioVisual({ ...visual, sources: [{ ...visual.sources[0], peaks: [NaN] }] })).toBeNull();
    expect(parseAudioVisual({ ...visual, sources: [{ ...visual.sources[0], peaks: Array(513).fill(0.5) }] })).toBeNull();
    expect(parseAudioVisual({ ...visual, sources: [{ ...visual.sources[0], silences: [{ start: 1, end: 11, removed_seconds: 1 }] }] })).toBeNull();
  });

  it("local silence metadata matches actual PCM removal and bounds extreme concat shapes", () => {
    const options: LocalAudioOptions = { operationMode: "concat", channelMode: "preserve", silenceEnabled: true,
      silenceThresholdDb: -30, silenceMinimumSeconds: 0.3, silenceKeepSeconds: 0.1, title: "" };
    const audio = { sampleRate: 10, channels: [Float32Array.from([0.5, 0.5, 0, 0, 0, 0, 0.5, 0.5])] };
    const model = buildLocalAudioVisual([audio], options);
    expect(parseAudioVisual(model)).not.toBeNull();
    expect(model.sources[0].silences).toEqual([{ start: 0.2, end: 0.6, removed_seconds: 0.3 }]);
    const [result] = processDecodedPcm([audio], options);
    expect(model.removed_seconds).toBeCloseTo((audio.channels[0].length - result.channels[0].length) / 10);
    const many = buildLocalAudioVisual([audio, ...Array.from({ length: 19 }, () => ({ sampleRate: 10, channels: [Float32Array.from([0.5])] }))], options);
    expect(parseAudioVisual(many)).not.toBeNull();
    expect(many.sources.reduce((sum, source) => sum + source.peaks.length, 0)).toBeLessThanOrEqual(512);
  });
});
