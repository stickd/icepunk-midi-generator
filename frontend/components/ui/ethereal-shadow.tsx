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
        <div
          className="absolute inset-0"
          style={{
            background: shadowColor
              ? `radial-gradient(circle at 10% 0%, ${shadowColor} 0%, transparent 42%)`
              : "radial-gradient(circle at 10% 0%, rgba(132, 146, 255, 0.2) 0%, transparent 42%), radial-gradient(circle at 92% 14%, rgba(98, 240, 191, 0.14) 0%, transparent 38%), radial-gradient(circle at 38% 100%, rgba(185, 130, 255, 0.15) 0%, transparent 44%)",
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
