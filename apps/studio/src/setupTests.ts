import '@testing-library/jest-dom/vitest';

// jsdom's File implementation still omits the standard Blob.stream() API
// used by Chromium's request-streaming upload path. Keep tests aligned with
// the supported browser contract without replacing production behavior.
if (typeof File.prototype.stream !== 'function') {
  Object.defineProperty(File.prototype, 'stream', {
    configurable: true,
    value(this: File) {
      let remaining = this.size;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (remaining <= 0) {
            controller.close();
            return;
          }
          const length = Math.min(64 * 1024, remaining);
          remaining -= length;
          controller.enqueue(new Uint8Array(length));
        },
      });
    },
  });
}
