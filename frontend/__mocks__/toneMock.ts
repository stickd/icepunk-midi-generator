// `tone` ships ESM-only, and it's only ever loaded via a dynamic `import("tone")`
// (see hooks/useBrowserMidiPlayback.ts) at runtime in a real browser. Jest's default
// transform can't parse its ESM output, so component tests that merely render (without
// ever triggering real audio playback) stub it out here instead of trying to transform
// the real package.
class StubTransport {
  seconds = 0;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  PPQ = 192;
  bpm = { value: 146, cancelScheduledValues: () => undefined, setValueAtTime: () => undefined };

  start() {}
  stop() {}
  pause() {}
  cancel() {}
  schedule() {
    return 0;
  }
}

class StubNode {
  connect() {
    return this;
  }
  toDestination() {
    return this;
  }
  dispose() {}
  triggerAttackRelease() {}
  releaseAll() {}
}

export const Transport = new StubTransport();

export function start() {
  return Promise.resolve();
}

export function now() {
  return 0;
}

export function Frequency(note: unknown) {
  return { toNote: () => String(note) };
}

export class Gain extends StubNode {}
export class Synth extends StubNode {}
export class Sampler extends StubNode {
  constructor(_options?: unknown) {
    super();
  }
}
export class PolySynth extends StubNode {
  constructor(..._args: unknown[]) {
    super();
  }
}

export type InputNode = StubNode;
