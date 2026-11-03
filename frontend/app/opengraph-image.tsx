import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "iCEPUNK MIDI Generator for Producers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "radial-gradient(circle at 80% 15%, #1d7aad 0%, transparent 32%), radial-gradient(circle at 10% 100%, #123960 0%, transparent 38%), #030b14",
          color: "#f1f9ff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "74px 82px",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", color: "#dff5ff", display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -2 }}>
          <span style={{ color: "#8edbff", fontSize: 46, marginRight: 18 }}>✦</span> iCEPUNK
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#9cccec", display: "flex", fontSize: 24, letterSpacing: 6, marginBottom: 22 }}>MIDI LAB</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 500, letterSpacing: -5, lineHeight: 1.06 }}>MIDI Generator</div>
          <div style={{ color: "#b9d2e6", display: "flex", fontSize: 37, letterSpacing: -1.5, marginTop: 18 }}>for producers</div>
        </div>
        <div style={{ alignItems: "center", borderTop: "1px solid rgba(182, 232, 255, 0.26)", color: "#9cccec", display: "flex", fontSize: 22, letterSpacing: 2, paddingTop: 25 }}>
          GENERATE · PREVIEW · EXPORT MIDI
        </div>
      </div>
    ),
    size,
  );
}
