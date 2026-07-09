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
        <div
          className="absolute inset-0 opacity-90 mix-blend-screen panel-glow-drift"
          style={{
            background:
              "radial-gradient(circle at 12% 8%, var(--theme-card-glow-1), transparent 34%), radial-gradient(circle at 90% 18%, var(--theme-card-glow-2), transparent 32%), radial-gradient(circle at 48% 100%, var(--theme-card-glow-3), transparent 38%)",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035),transparent_36%,rgba(110,231,255,0.035))]" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default InteractiveBubbleBackground;
