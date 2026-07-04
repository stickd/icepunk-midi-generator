"use client";

import { cn } from "@/lib/ui";
import React, { ReactNode } from "react";

interface EtherealShadowProps extends React.HTMLProps<HTMLDivElement> {
  children?: ReactNode;
  shadowColor?: string;
  glowOpacity?: number;
}

export const EtherealShadowBackground = ({
  className,
  children,
  shadowColor,
  glowOpacity = 0.55,
  ...props
}: EtherealShadowProps) => {
  const ambientOpacity = Math.min(1, Math.max(0, glowOpacity));

  return (
    <main
      className={cn(
        "relative flex flex-col min-h-screen bg-[#060812] text-white transition-bg overflow-x-hidden",
        className
      )}
      {...props}
    >
      {/* Balanced Tinted Glass Swirling Shadows Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#060812]">
        {/* Swirling Shadow Aura 1 - Periwinkle Accent */}
        <div
          className="absolute -top-[15%] -left-[10%] w-[70vw] h-[70vw] max-w-[950px] rounded-full animate-aurora-1 blur-[100px] transform-gpu"
          style={{
            background: shadowColor
              ? `radial-gradient(circle, ${shadowColor} 0%, transparent 75%)`
              : "radial-gradient(circle, rgba(132, 146, 255, 0.48) 0%, rgba(92, 108, 255, 0.18) 45%, transparent 75%)",
            opacity: ambientOpacity,
          }}
        />

        {/* Swirling Shadow Aura 2 - Cyan Ice */}
        <div
          className="absolute top-[15%] -right-[10%] w-[65vw] h-[65vw] max-w-[900px] rounded-full animate-aurora-2 blur-[110px] transform-gpu"
          style={{
            background: "radial-gradient(circle, rgba(110, 231, 255, 0.42) 0%, rgba(40, 180, 220, 0.14) 45%, transparent 75%)",
            opacity: Math.max(0.3, ambientOpacity - 0.05),
          }}
        />

        {/* Swirling Shadow Aura 3 - Deep Midnight Violet */}
        <div
          className="absolute -bottom-[15%] left-[20%] w-[75vw] h-[75vw] max-w-[1050px] rounded-full animate-aurora-3 blur-[120px] transform-gpu"
          style={{
            background: "radial-gradient(circle, rgba(185, 130, 255, 0.38) 0%, rgba(120, 70, 220, 0.12) 45%, transparent 75%)",
            opacity: Math.max(0.28, ambientOpacity - 0.07),
          }}
        />

        {/* Translucent Frosted Glass Tint Layer */}
        <div className="absolute inset-0 bg-[#060812]/45 backdrop-blur-[50px]" />

        {/* High-Impact Tactile Film Grain Noise Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg_xmlns=%22http://www.w3.org/2000/svg%22><filter_id=%22n%22><feTurbulence_type=%22fractalNoise%22_baseFrequency=%220.85%22_numOctaves=%224%22_stitchTiles=%22stitch%22/></filter><rect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/></svg>')] opacity-[0.18] mix-blend-overlay pointer-events-none" />
      </div>

      {children}
    </main>
  );
};
