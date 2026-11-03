"use client";
import { cn } from "@/lib/ui";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children?: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <main
      className={cn(
        "relative flex flex-col min-h-screen bg-[#05060d] text-white transition-bg overflow-x-hidden",
        className
      )}
      {...props}
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className={cn(
            `
          [--transparent:transparent]
          [--black:#05060d]
          [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_8%,var(--transparent)_12%,var(--transparent)_15%,var(--black)_18%)]
          [--aurora:repeating-linear-gradient(100deg,rgba(132,146,255,0.22)_10%,rgba(191,140,255,0.18)_15%,rgba(110,231,255,0.2)_20%,rgba(132,146,255,0.16)_25%,rgba(110,231,255,0.22)_30%)]
          [background-image:var(--dark-gradient),var(--aurora)]
          [background-size:300%,_200%]
          animate-aurora
          filter blur-[130px]
          after:content-[""] after:absolute after:inset-0 after:[background-image:var(--dark-gradient),var(--aurora)] 
          after:[background-size:200%,_100%] 
          after:animate-aurora after:mix-blend-difference
          pointer-events-none
          absolute -inset-[20px] opacity-40 will-change-transform`,

            showRadialGradient &&
              `[mask-image:radial-gradient(ellipse_at_100%_0%,black_20%,var(--transparent)_80%)]`
          )}
        />

        {/* Ambient Dark Vignette Tint */}
        <div className="absolute inset-0 bg-[#05060d]/60 backdrop-blur-[40px]" />

        {/* Tactile High-Density Film Grain Noise Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg_xmlns=%22http://www.w3.org/2000/svg%22><filter_id=%22n%22><feTurbulence_type=%22fractalNoise%22_baseFrequency=%220.88%22_numOctaves=%224%22_stitchTiles=%22stitch%22/></filter><rect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/></svg>')] opacity-[0.32] mix-blend-overlay pointer-events-none" />
      </div>
      {children}
    </main>
  );
};
