import '@testing-library/jest-dom/vitest';

class FetchBackedUploadRequest extends EventTarget {
  readonly upload = new EventTarget();
  status = 0;
  timeout = 0;
  withCredentials = false;
  responseURL = '';

  private method = 'GET';
  private url = '';
  private headers: Record<string, string> = {};
  private controller: AbortController | null = null;
  private timer: number | null = null;
  private settled = false;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
    this.responseURL = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: Document | XMLHttpRequestBodyInit | null = null) {
    this.controller = new AbortController();
    const total = body instanceof Blob ? body.size : 0;
    if (this.timeout > 0) {
      this.timer = window.setTimeout(() => {
        if (this.settled) return;
        this.settled = true;
        this.controller?.abort();
        this.dispatchEvent(new ProgressEvent('timeout'));
      }, this.timeout);
    }
    Promise.resolve(fetch(this.url, {
      method: this.method,
      headers: this.headers,
      body: body as BodyInit | null,
      credentials: this.withCredentials ? 'include' : 'omit',
      signal: this.controller.signal,
    })).then(
      (response) => {
        if (this.settled) return;
        this.settled = true;
        this.clearTimer();
        this.status = response.status;
        this.upload.dispatchEvent(new ProgressEvent('progress', {
          lengthComputable: total > 0,
          loaded: total,
          total,
        }));
        this.upload.dispatchEvent(new ProgressEvent('load'));
        this.dispatchEvent(new ProgressEvent('load'));
      },
      () => {
        if (this.settled) return;
        this.settled = true;
        this.clearTimer();
        this.dispatchEvent(new ProgressEvent('error'));
      },
    );
  }

  abort() {
    if (this.settled) return;
    this.settled = true;
    this.clearTimer();
    this.controller?.abort();
    this.dispatchEvent(new ProgressEvent('abort'));
  }

  private clearTimer() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}

Object.defineProperty(globalThis, 'XMLHttpRequest', {
  configurable: true,
  writable: true,
  value: FetchBackedUploadRequest,
});
