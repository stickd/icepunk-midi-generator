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

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "featured";

const toneClasses: Record<Tone, string> = {
  neutral: "border-white/[0.08] bg-white/[0.05] text-white/[0.55]",
  accent:
    "border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] text-[color:var(--ice-accent-text)]",
  success: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200/90",
  warning: "border-amber-300/25 bg-amber-400/10 text-amber-200/90",
  danger: "border-rose-300/25 bg-rose-400/10 text-rose-200/90",
  featured: "border-amber-300/30 bg-amber-400/[0.08] text-amber-200/95",
};

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] text-[color:var(--ice-accent-text)] hover:bg-[rgba(100,120,255,0.25)]",
  secondary:
    "border-white/[0.09] bg-white/[0.04] text-white/[0.55] hover:bg-white/[0.08] hover:text-white/[0.8]",
  ghost:
    "border-transparent bg-transparent text-ice-secondary hover:bg-white/[0.05] hover:text-ice-primary",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-4 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-sm",
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
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border font-medium tracking-[0.02em] outline-none",
        "transition-[background-color,color,border-color,transform] duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080f]",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.97]",
        "after:pointer-events-none after:absolute after:inset-x-[10%] after:top-0 after:h-[40%] after:rounded-full after:bg-gradient-to-b after:from-white/[0.09] after:to-transparent",
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
      className={cn("h-9 w-9 rounded-full px-0", className)}
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
        "rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[color:var(--ice-surface)] text-ice-primary backdrop-blur-xl",
        elevated && "shadow-[var(--ice-shadow-card)]",
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
        "rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[color:var(--ice-surface)] text-ice-primary shadow-[var(--ice-shadow-card)] backdrop-blur-xl",
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
      className={cn("grid gap-2 text-sm font-medium text-ice-primary/90", className)}
      {...props}
    />
  );
}

const controlClasses =
  "h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-ice-primary outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-white/[0.35] focus:border-[color:var(--ice-accent-border)] focus:ring-2 focus:ring-[rgba(100,120,255,0.15)] disabled:cursor-not-allowed disabled:opacity-60";

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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]",
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
    <Badge className={cn("gap-2 normal-case tracking-normal text-xs", className)} tone="success">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
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
        "inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1",
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
            "rounded-full px-4 py-1.5 text-sm font-medium text-ice-muted outline-none",
            "transition-[background-color,color] duration-150 ease-out",
            "focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]",
            option.value === value
              ? "bg-[color:var(--ice-accent-soft)] text-[color:var(--ice-accent-text)]"
              : "hover:bg-white/[0.05] hover:text-ice-primary",
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
        "animate-pulse rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.09),rgba(255,255,255,0.04))]",
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
        <div className="mx-auto mb-5 h-10 w-10 rounded-xl border border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)]" />
        <h3 className="text-lg font-semibold text-ice-primary">{title}</h3>
        {description && (
          <p className="mt-2 text-sm leading-6 text-ice-secondary">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </Panel>
  );
}
