"use client";

import { useEffect, useRef } from "react";

export default function HalftoneBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getContext !== "function") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let time = 0;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const render = () => {
      time += 0.007;
      ctx.clearRect(0, 0, width, height);

      // 4 Organic moving wave focal points for dynamic random motion
      const p1 = {
        x: width * 0.3 + Math.sin(time * 0.9) * 220 + Math.cos(time * 0.4) * 80,
        y: height * 0.35 + Math.cos(time * 0.7) * 160 + Math.sin(time * 1.2) * 90,
      };
      const p2 = {
        x: width * 0.75 + Math.cos(time * 1.1) * 240 + Math.sin(time * 0.5) * 100,
        y: height * 0.6 + Math.sin(time * 0.85) * 180 + Math.cos(time * 1.3) * 70,
      };
      const p3 = {
        x: width * 0.5 + Math.sin(time * 1.3) * 190,
        y: height * 0.8 + Math.cos(time * 1.1) * 140,
      };

      // Render fluid liquid marble gradient pools
      const g1 = ctx.createRadialGradient(p1.x, p1.y, 10, p1.x, p1.y, width * 0.38);
      g1.addColorStop(0, "rgba(132, 146, 255, 0.18)");
      g1.addColorStop(0.5, "rgba(92, 108, 255, 0.06)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const g2 = ctx.createRadialGradient(p2.x, p2.y, 10, p2.x, p2.y, width * 0.35);
      g2.addColorStop(0, "rgba(110, 231, 255, 0.16)");
      g2.addColorStop(0.5, "rgba(40, 180, 220, 0.05)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      const g3 = ctx.createRadialGradient(p3.x, p3.y, 10, p3.x, p3.y, width * 0.35);
      g3.addColorStop(0, "rgba(191, 140, 255, 0.14)");
      g3.addColorStop(0.5, "rgba(130, 80, 230, 0.04)");
      g3.addColorStop(1, "transparent");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, width, height);

      const dotSpacing = 38; // Spaced further apart as requested
      const cols = Math.ceil(width / dotSpacing) + 1;
      const rows = Math.ceil(height / dotSpacing) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * dotSpacing;
          const y = r * dotSpacing;

          const d1 = Math.hypot(x - p1.x, y - p1.y);
          const d2 = Math.hypot(x - p2.x, y - p2.y);
          const d3 = Math.hypot(x - p3.x, y - p3.y);

          const inf1 = Math.max(0, 1 - d1 / (width * 0.5));
          const inf2 = Math.max(0, 1 - d2 / (width * 0.5));
          const inf3 = Math.max(0, 1 - d3 / (width * 0.5));

          // Organic wave pulse
          const organicWave = Math.sin(x * 0.006 + time * 1.4) * Math.cos(y * 0.006 - time * 1.1) * 3.5;
          const radius = Math.max(1, inf1 * 10 + inf2 * 9.5 + inf3 * 8 + organicWave);

          if (radius <= 1) continue;

          const opacity = Math.min(0.42, Math.max(0.04, (radius / 12) * 0.38));

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);

          if (inf1 >= inf2 && inf1 >= inf3) {
            ctx.fillStyle = `rgba(132, 146, 255, ${opacity})`;
          } else if (inf2 >= inf1 && inf2 >= inf3) {
            ctx.fillStyle = `rgba(110, 231, 255, ${opacity})`;
          } else {
            ctx.fillStyle = `rgba(191, 140, 255, ${opacity})`;
          }
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* Deep Soft Blurred Halftone Dot Matrix Canvas */}
      <canvas
        ref={canvasRef}
        className="h-full w-full opacity-90 blur-[7.5px] transform-gpu"
      />

      {/* Ambient Radial Aurora Glow */}
      <div className="absolute -left-[10%] -top-[10%] h-[55vw] w-[55vw] max-w-[800px] animate-aurora-1 rounded-full bg-[radial-gradient(circle,rgba(132,146,255,0.22)_0%,transparent_70%)] blur-[105px] transform-gpu" />
      <div className="absolute -right-[5%] top-[20%] h-[50vw] w-[50vw] max-w-[700px] animate-aurora-2 rounded-full bg-[radial-gradient(circle,rgba(110,231,255,0.18)_0%,transparent_70%)] blur-[115px] transform-gpu" />

      {/* High-Impact Tactile Film Grain Noise Overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg_xmlns=%22http://www.w3.org/2000/svg%22><filter_id=%22n%22><feTurbulence_type=%22fractalNoise%22_baseFrequency=%220.9%22_numOctaves=%224%22_stitchTiles=%22stitch%22/></filter><rect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/></svg>')] opacity-[0.16] mix-blend-overlay" />
    </div>
  );
}
