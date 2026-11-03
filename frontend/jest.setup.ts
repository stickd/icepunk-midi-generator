// jsdom's AbortController/AbortSignal implementation predates the
// AbortSignal.timeout/.any statics, so polyfill them for the test environment.
// Real browsers and the Node runtime used in production both support these natively.
if (typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();

    setTimeout(() => {
      controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
    }, ms);

    return controller.signal;
  };
}

if (typeof AbortSignal.any !== "function") {
  AbortSignal.any = (signals: AbortSignal[]): AbortSignal => {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }

      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }

    return controller.signal;
  };
}
