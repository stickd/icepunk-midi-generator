"use client";

import { useEffect, useRef } from "react";

const MATRIX_CHARS = [
  "0", "1", "♪", "♫", "♩", "∿", "⚡", "I", "C", "E", "P", "U", "N", "K",
  "M", "I", "D", "I", "1", "0", "4", "0", "D", "#", "m"
];

export default function AsciiBackground() {
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

    const fontSize = 13;
    const columns = Math.floor(width / 34); // Space out columns nicely
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.floor(Math.random() * -50)
    );

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const draw = () => {
      // Clear with subtle dark overlay to create trail effect
      ctx.fillStyle = "rgba(6, 8, 14, 0.08)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char =
          MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const x = i * 34 + 10;
        const y = drops[i] * fontSize;

        // Subtle periwinkle/cyan lead head, soft tail
        if (y > 0) {
          // Leading char glow
          ctx.fillStyle = "rgba(160, 174, 255, 0.16)";
          ctx.fillText(char, x, y);

          // Second char faint trailing
          ctx.fillStyle = "rgba(110, 231, 255, 0.05)";
          ctx.fillText(char, x, y - fontSize);
        }

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-80 select-none"
    />
  );
}
