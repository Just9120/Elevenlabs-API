import { describe, expect, it } from "vitest";
import { audioSourceTitle } from "./audioOutputNaming";

describe("audio source titles", () => {
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
