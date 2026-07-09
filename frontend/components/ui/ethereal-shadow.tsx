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
        "relative flex flex-col min-h-screen bg-background text-white transition-bg overflow-x-hidden",
        className
      )}
      {...props}
    >
      {/* Balanced Tinted Glass Swirling Shadows Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-background">
        <div
          className="absolute inset-0"
          style={{
            background: shadowColor
              ? `radial-gradient(circle at 10% 0%, ${shadowColor} 0%, transparent 42%)`
              : "radial-gradient(circle at 10% 0%, var(--theme-glow-1) 0%, transparent 42%), radial-gradient(circle at 92% 14%, var(--theme-glow-2) 0%, transparent 38%), radial-gradient(circle at 38% 100%, var(--theme-glow-5) 0%, transparent 44%)",
            opacity: ambientOpacity,
          }}
        />

        {/* Translucent Tint Layer */}
        <div className="absolute inset-0 bg-[#05060a]/20" />
      </div>

      {children}
    </main>
  );
};
