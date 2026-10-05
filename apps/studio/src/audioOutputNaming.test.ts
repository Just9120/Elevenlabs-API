import { describe, expect, it } from "vitest";
import { audioSourceTitle, audioNamedTitle } from "./audioOutputNaming";

describe("audio source titles", () => {
  it("uses known UTC creation time and omits missing or invalid time", () => {
    expect(audioNamedTitle("Лекция 1. Фрагмент", "dateTime", "2026-10-06T12:34:56+03:00")).toBe("2026-10-06_09-34-56Z_Лекция 1. Фрагмент");
    expect(audioNamedTitle("Лекция 1", "date", "2026-10-06T12:34:56Z")).toBe("2026-10-06_Лекция 1");
    expect(audioNamedTitle("Лекция 1", "dateTime", null)).toBe("Лекция 1");
    expect(audioNamedTitle("Лекция 1", "dateTime", "invalid")).toBe("Лекция 1");
  });
  it.each([
    ["Лекция 1. Предмет, задачи и методы социальной психологии.mp4", "Лекция 1. Предмет, задачи и методы социальной психологии"],
    ["Лекция 1. Предмет, задачи и методы социальной психологии", "Лекция 1. Предмет, задачи и методы социальной психологии"],
    ["Созвон.2026.09.06.FLAC", "Созвон.2026.09.06"],
    ["Материалы.v2", "Материалы.v2"],
    ["lecture.final.mp3 ", "lecture.final"],
    ["lecture", "lecture"],
  ])("preserves the title in %s", (filename, expected) => {
    expect(audioSourceTitle(filename)).toBe(expected);
  });
});
