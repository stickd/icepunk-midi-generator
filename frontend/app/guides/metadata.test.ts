import { metadata as abletonMetadata } from "./ableton-midi/page";
import { metadata as flStudioMetadata } from "./fl-studio-midi/page";

describe("DAW guide metadata", () => {
  it("gives each guide a distinct canonical URL and social title", () => {
    expect(flStudioMetadata.alternates?.canonical).toBe("/guides/fl-studio-midi");
    expect(abletonMetadata.alternates?.canonical).toBe("/guides/ableton-midi");
    expect(flStudioMetadata.openGraph?.url).toBe("/guides/fl-studio-midi");
    expect(abletonMetadata.openGraph?.url).toBe("/guides/ableton-midi");
    expect(flStudioMetadata.title).toBe("How to Import MIDI into FL Studio");
    expect(abletonMetadata.title).toBe("How to Import MIDI into Ableton Live");
  });
});
