"use client";

import { HTMLAttributes, useEffect, useRef } from "react";
import { cn } from "@/lib/ui";

type InteractiveBubbleBackgroundProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children?: React.ReactNode;
};

export function InteractiveBubbleBackground({
  className,
  children,
  ...props
}: InteractiveBubbleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactiveBubbleRef = useRef<HTMLDivElement>(null);

  // Position tracking using linear interpolation (lerp) for 60fps fluid motion
  const mousePos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mousePos.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
      } else {
        mousePos.current = {
          x: event.clientX,
          y: event.clientY,
        };
      }
    };

    // Initialize position at container center
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mousePos.current = { x: rect.width / 2, y: rect.height / 2 };
    } else {
      mousePos.current = { x: 300, y: 250 };
    }
    currentPos.current = { ...mousePos.current };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Smooth lerp loop (linear interpolation with 0.08 damping)
    const animate = () => {
      const targetX = mousePos.current.x;
      const targetY = mousePos.current.y;

      currentPos.current.x += (targetX - currentPos.current.x) * 0.08;
      currentPos.current.y += (targetY - currentPos.current.y) * 0.08;

      if (interactiveBubbleRef.current) {
        interactiveBubbleRef.current.style.transform = `translate3d(${currentPos.current.x - 200}px, ${currentPos.current.y - 200}px, 0)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-hidden text-white",
        className,
      )}
      {...props}
    >
      {/* Background Layer inside Card */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-inherit">
        {/* SVG Displacement Filter for Liquid Organic Warp */}
        <svg className="hidden">
          <defs>
            <filter id="liquid-card-bubble-warp" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.018"
                numOctaves="3"
                result="noise"
              >
                <feAnimate
                  attributeName="baseFrequency"
                  values="0.018;0.028;0.018"
                  dur="20s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="50"
                xChannelSelector="R"
                yChannelSelector="G"
              />
              <feGaussianBlur stdDeviation="35" />
            </filter>
          </defs>
        </svg>

        {/* Ambient Container with Blending */}
        <div className="absolute inset-0 filter [filter:url(#liquid-card-bubble-warp)]">
          {/* Bubble 1: Cold Periwinkle / Indigo (Top-Left Floating) */}
          <div className="absolute -top-[20%] -left-[20%] w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle_at_center,rgba(132,146,255,0.4),rgba(92,108,255,0.15)_60%,transparent_100%)] blur-[120px] opacity-35 animate-aurora-1 mix-blend-screen" />

          {/* Bubble 2: Ethereal Purple / Magenta (Top-Right Floating) */}
          <div className="absolute top-[10%] -right-[20%] w-[320px] h-[320px] rounded-full bg-[radial-gradient(circle_at_center,rgba(162,28,175,0.35),rgba(124,58,237,0.15)_60%,transparent_100%)] blur-[130px] opacity-30 animate-aurora-2 mix-blend-screen" />

          {/* Bubble 3: Deep Subzero Blue (Bottom Center Floating) */}
          <div className="absolute -bottom-[20%] left-[10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.35),rgba(59,130,246,0.15)_60%,transparent_100%)] blur-[140px] opacity-30 animate-aurora-3 mix-blend-screen" />

          {/* Bubble 4: Interactive Mouse Tracking Cyan Bubble */}
          <div
            ref={interactiveBubbleRef}
            className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(110,231,255,0.45),rgba(6,182,212,0.2)_50%,transparent_80%)] blur-[110px] opacity-35 mix-blend-screen pointer-events-none will-change-transform"
          />
        </div>

        {/* 16% Film Grain Overlay for Textured Analog Depth */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg_xmlns=%22http://www.w3.org/2000/svg%22><filter_id=%22n%22><feTurbulence_type=%22fractalNoise%22_baseFrequency=%220.85%22_numOctaves=%224%22_stitchTiles=%22stitch%22/></filter><rect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/></svg>')] opacity-[0.16] mix-blend-overlay pointer-events-none" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default InteractiveBubbleBackground;
