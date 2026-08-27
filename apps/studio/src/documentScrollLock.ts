const SCROLLABLE_DIALOG_SELECTOR = "[data-studio-scroll-lock-allow]";

type ScrollSnapshot = {
  bodyStyle: string | null;
  documentStyle: string | null;
  scrollX: number;
  scrollY: number;
};

let lockCount = 0;
let snapshot: ScrollSnapshot | null = null;

function isInsideScrollableDialog(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(SCROLLABLE_DIALOG_SELECTOR) !== null
  );
}

function preventBackgroundScroll(event: Event) {
  if (!isInsideScrollableDialog(event.target)) event.preventDefault();
}

function restoreLockedPosition() {
  if (!snapshot) return;
  if (window.scrollX === snapshot.scrollX && window.scrollY === snapshot.scrollY) {
    return;
  }
  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
}

function restoreStyle(
  element: HTMLElement,
  value: string | null,
) {
  if (value === null) element.removeAttribute("style");
  else element.setAttribute("style", value);
}

export function lockDocumentScroll(): () => void {
  if (lockCount === 0) {
    snapshot = {
      bodyStyle: document.body.getAttribute("style"),
      documentStyle: document.documentElement.getAttribute("style"),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.addEventListener("wheel", preventBackgroundScroll, {
      capture: true,
      passive: false,
    });
    document.addEventListener("touchmove", preventBackgroundScroll, {
      capture: true,
      passive: false,
    });
    window.addEventListener("scroll", restoreLockedPosition, {
      passive: true,
    });
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount !== 0 || !snapshot) return;
    const releasedSnapshot = snapshot;
    snapshot = null;
    document.removeEventListener("wheel", preventBackgroundScroll, true);
    document.removeEventListener("touchmove", preventBackgroundScroll, true);
    window.removeEventListener("scroll", restoreLockedPosition);
    restoreStyle(document.documentElement, releasedSnapshot.documentStyle);
    restoreStyle(document.body, releasedSnapshot.bodyStyle);
    if (
      window.scrollX !== releasedSnapshot.scrollX ||
      window.scrollY !== releasedSnapshot.scrollY
    ) {
      window.scrollTo(releasedSnapshot.scrollX, releasedSnapshot.scrollY);
    }
  };
}
