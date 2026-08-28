import { describe, expect, it } from "vitest";
import { appendUniqueItems } from "./collectionPageModel";

describe("collection page append", () => {
  it("preserves first-page order and removes cursor-boundary duplicates", () => {
    const current = [{ id: "newest" }, { id: "boundary" }];
    const next = [
      { id: "boundary" },
      { id: "older" },
      { id: "oldest" },
    ];

    expect(appendUniqueItems(current, next).map((item) => item.id)).toEqual([
      "newest",
      "boundary",
      "older",
      "oldest",
    ]);
    expect(appendUniqueItems([], next)).toEqual(next);
  });
});
