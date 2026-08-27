import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lockDocumentScroll } from "./documentScrollLock";

describe("document scroll lock", () => {
  let scrollX = 0;
  let scrollY = 0;

  beforeEach(() => {
    scrollX = 24;
    scrollY = 360;
    Object.defineProperty(window, "scrollX", {
      configurable: true,
      get: () => scrollX,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollY,
    });
    vi.spyOn(window, "scrollTo").mockImplementation((x, y) => {
      if (typeof x === "number") scrollX = x;
      if (typeof y === "number") scrollY = y;
    });
    document.documentElement.setAttribute(
      "style",
      "color-scheme: dark; overflow: auto",
    );
    document.body.setAttribute("style", "padding-right: 7px");
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("blocks background scroll and restores exact styles and position", () => {
    const release = lockDocumentScroll();

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");
    expect(document.body.style.overflow).toBe("hidden");

    const backgroundWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(backgroundWheel);
    expect(backgroundWheel.defaultPrevented).toBe(true);

    const dialog = document.createElement("div");
    dialog.dataset.studioScrollLockAllow = "true";
    document.body.appendChild(dialog);
    const dialogWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
    });
    dialog.dispatchEvent(dialogWheel);
    expect(dialogWheel.defaultPrevented).toBe(false);

    scrollX = 90;
    scrollY = 900;
    window.dispatchEvent(new Event("scroll"));
    expect(window.scrollTo).toHaveBeenCalledWith(24, 360);

    release();
    release();
    expect(document.documentElement.getAttribute("style")).toBe(
      "color-scheme: dark; overflow: auto",
    );
    expect(document.body.getAttribute("style")).toBe("padding-right: 7px");
    expect(window.scrollTo).toHaveBeenLastCalledWith(24, 360);
  });

  it("keeps the document locked until the final nested owner releases it", () => {
    const releaseFirst = lockDocumentScroll();
    const releaseSecond = lockDocumentScroll();

    releaseFirst();
    expect(document.body.style.overflow).toBe("hidden");

    releaseSecond();
    expect(document.body.getAttribute("style")).toBe("padding-right: 7px");
  });
});
