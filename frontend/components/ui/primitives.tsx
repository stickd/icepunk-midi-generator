import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/ui";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/[0.055] text-ice-primary",
  accent: "border-[color:var(--ice-border-accent)] bg-[color:var(--ice-accent-soft)] text-ice-primary",
  success: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  danger: "border-rose-300/20 bg-rose-300/10 text-rose-100",
};

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-white/75 bg-gradient-to-b from-white via-cyan-50 to-sky-200 text-slate-950 shadow-[0_14px_44px_rgba(56,189,248,0.18),inset_0_1px_0_rgba(255,255,255,1),inset_0_-8px_18px_rgba(14,165,233,0.14)] hover:shadow-[0_18px_58px_rgba(125,211,252,0.28),inset_0_1px_0_rgba(255,255,255,1),inset_0_-10px_22px_rgba(14,165,233,0.18)]",
  secondary:
    "border-white/10 bg-white/[0.055] text-ice-primary shadow-[0_12px_36px_rgba(0,0,0,0.18)] hover:border-cyan-200/35 hover:bg-white/[0.08]",
  ghost:
    "border-transparent bg-transparent text-ice-secondary hover:bg-white/[0.055] hover:text-ice-primary",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-6 text-base",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border font-bold outline-none transition duration-200",
        "focus-visible:ring-2 focus-visible:ring-cyan-200/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
        "disabled:pointer-events-none disabled:opacity-55",
        "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      className={cn("h-10 w-10 rounded-full px-0", className)}
      variant="secondary"
      {...props}
    />
  );
}

export function Panel({
  className,
  elevated = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--ice-radius-panel)] border border-white/10 bg-[color:var(--ice-surface-glass)] text-ice-primary backdrop-blur-2xl",
        elevated && "shadow-[var(--ice-shadow-panel)]",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--ice-radius-card)] border border-white/10 bg-[color:var(--ice-surface-elevated)] text-ice-primary shadow-[var(--ice-shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("grid gap-2 text-sm font-semibold text-ice-primary/90", className)}
      {...props}
    />
  );
}

const controlClasses =
  "h-11 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-medium text-ice-primary outline-none transition placeholder:text-ice-muted focus:border-cyan-200/55 focus:ring-2 focus:ring-cyan-200/15 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        controlClasses,
        "min-h-28 resize-none py-3 leading-6",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClasses, className)} {...props} />;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

export function CreditBadge({
  credits,
  className,
}: {
  credits: number | string;
  className?: string;
}) {
  return (
    <Badge
      className={cn("gap-2 border-emerald-300/25 bg-emerald-400/12 text-emerald-100", className)}
      tone="success"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
      {credits} credits
    </Badge>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-white/10 bg-white/[0.045] p-1",
        className,
      )}
      role="tablist"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-bold text-ice-muted outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-cyan-200/45",
            option.value === value
              ? "bg-white text-slate-950 shadow-[0_8px_24px_rgba(255,255,255,0.12)]"
              : "hover:bg-white/[0.055] hover:text-ice-primary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <progress
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-white/10 accent-[color:var(--ice-accent)]",
        className,
      )}
      max={100}
      value={normalizedValue}
    />
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(255,255,255,0.055),rgba(255,255,255,0.11),rgba(255,255,255,0.055))]",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("grid place-items-center px-6 py-10 text-center", className)}>
      <div className="max-w-sm">
        <div className="mx-auto mb-5 h-10 w-10 rounded-2xl border border-cyan-100/20 bg-cyan-100/10" />
        <h3 className="text-lg font-black text-ice-primary">{title}</h3>
        {description && (
          <p className="mt-2 text-sm leading-6 text-ice-secondary">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </Panel>
  );
}
