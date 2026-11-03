import { HTMLAttributes } from "react";
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
  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden text-white",
        className,
      )}
      {...props}
    >
      {/* Background Layer inside Card */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-inherit">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(132,146,255,0.18),transparent_34%),radial-gradient(circle_at_90%_18%,rgba(191,140,255,0.14),transparent_32%),radial-gradient(circle_at_48%_100%,rgba(110,231,255,0.12),transparent_38%)] opacity-90 mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035),transparent_36%,rgba(110,231,255,0.035))]" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default InteractiveBubbleBackground;
