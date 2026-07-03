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

type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "featured";

const toneClasses: Record<Tone, string> = {
  neutral:
    "border-[color:var(--ice-border)] bg-[rgba(255,255,255,0.045)] text-[color:var(--ice-text-secondary)]",
  accent:
    "border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] text-[color:var(--ice-accent-text)] shadow-[var(--ice-shadow-accent)]",
  success:
    "border-[rgba(98,240,191,0.3)] bg-[rgba(98,240,191,0.1)] text-[rgba(198,255,235,0.94)]",
  warning:
    "border-[rgba(255,211,110,0.3)] bg-[rgba(255,211,110,0.1)] text-[rgba(255,235,184,0.94)]",
  danger:
    "border-[rgba(255,120,149,0.3)] bg-[rgba(255,120,149,0.1)] text-[rgba(255,204,215,0.94)]",
  featured:
    "border-[rgba(191,140,255,0.35)] bg-[rgba(191,140,255,0.11)] text-[rgba(234,220,255,0.96)] shadow-[0_0_36px_rgba(191,140,255,0.11)]",
};

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-[rgba(188,200,255,0.5)] bg-[linear-gradient(180deg,rgba(160,174,255,0.42),rgba(92,108,255,0.24))] text-white shadow-[0_18px_54px_rgba(92,108,255,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] hover:border-[rgba(220,228,255,0.65)] hover:bg-[linear-gradient(180deg,rgba(178,190,255,0.5),rgba(106,122,255,0.3))] hover:shadow-[0_22px_70px_rgba(92,108,255,0.36),0_0_34px_rgba(110,231,255,0.09),inset_0_1px_0_rgba(255,255,255,0.26)]",
  secondary:
    "border-[color:var(--ice-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.085),rgba(255,255,255,0.038))] text-[color:var(--ice-text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:border-[color:var(--ice-border-strong)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.052))] hover:text-[color:var(--ice-text-primary)]",
  ghost:
    "border-transparent bg-transparent text-[color:var(--ice-text-secondary)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--ice-text-primary)]",
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
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border font-semibold tracking-[0.02em] outline-none",
        "transition-[background,border-color,color,box-shadow,transform,opacity] duration-200 ease-out",
        "focus-visible:ring-2 focus-visible:ring-[rgba(160,174,255,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ice-bg)]",
        "disabled:pointer-events-none disabled:opacity-45",
        "active:scale-[0.975]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.22),transparent_44%)] before:opacity-70",
        "after:pointer-events-none after:absolute after:inset-x-[16%] after:top-0 after:h-px after:bg-white/30",
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
        "relative overflow-hidden rounded-[var(--ice-radius-card)] border border-[color:var(--ice-border)]",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.032))]",
        "text-[color:var(--ice-text-primary)] backdrop-blur-2xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_0%,rgba(132,146,255,0.11),transparent_34%),radial-gradient(circle_at_92%_6%,rgba(110,231,255,0.06),transparent_28%)]",
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
        "relative overflow-hidden rounded-[var(--ice-radius-card)] border border-[color:var(--ice-border)]",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.085),rgba(255,255,255,0.038))]",
        "text-[color:var(--ice-text-primary)] backdrop-blur-2xl",
        "shadow-[var(--ice-shadow-card)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_16%_0%,rgba(132,146,255,0.13),transparent_36%),radial-gradient(circle_at_88%_8%,rgba(110,231,255,0.07),transparent_30%)]",
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-white/[0.12]",
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
      className={cn(
        "grid gap-2 text-sm font-medium text-[color:var(--ice-text-primary)]/90",
        className,
      )}
      {...props}
    />
  );
}

const controlClasses =
  "h-10 rounded-2xl border border-[color:var(--ice-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.035))] px-4 text-sm text-[color:var(--ice-text-primary)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow,background] duration-200 ease-out placeholder:text-[color:var(--ice-text-muted)] focus:border-[rgba(170,184,255,0.5)] focus:shadow-[0_0_0_3px_rgba(132,146,255,0.13),0_0_28px_rgba(110,231,255,0.045),inset_0_1px_0_rgba(255,255,255,0.08)] disabled:cursor-not-allowed disabled:opacity-55";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.085em] backdrop-blur-xl",
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
      className={cn("gap-2 normal-case tracking-normal text-xs", className)}
      tone="success"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ice-success)] shadow-[0_0_16px_rgba(98,240,191,0.65)]" />
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
        "inline-flex rounded-full border border-[color:var(--ice-border)] bg-[rgba(255,255,255,0.04)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl",
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
            "rounded-full px-4 py-1.5 text-sm font-medium text-[color:var(--ice-text-muted)] outline-none",
            "transition-[background,color,box-shadow] duration-200 ease-out",
            "focus-visible:ring-2 focus-visible:ring-[rgba(160,174,255,0.5)]",
            option.value === value
              ? "bg-[linear-gradient(180deg,rgba(160,174,255,0.28),rgba(100,116,255,0.15))] text-[color:var(--ice-accent-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_10px_24px_rgba(92,108,255,0.16)]"
              : "hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--ice-text-primary)]",
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
        "h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)] accent-[color:var(--ice-accent)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]",
        className,
      )}
      max={100}
      value={normalizedValue}
    />
  );
}

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.035),rgba(160,174,255,0.11),rgba(255,255,255,0.035))]",
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
    <Panel
      className={cn(
        "grid place-items-center px-6 py-10 text-center",
        className,
      )}
    >
      <div className="relative max-w-sm">
        <div className="mx-auto mb-5 h-10 w-10 rounded-2xl border border-[color:var(--ice-accent-border)] bg-[linear-gradient(180deg,rgba(160,174,255,0.26),rgba(100,116,255,0.12))] shadow-[0_16px_38px_rgba(92,108,255,0.18),inset_0_1px_0_rgba(255,255,255,0.16)]" />
        <h3 className="text-lg font-semibold text-[color:var(--ice-text-primary)]">
          {title}
        </h3>
        {description && (
          <p className="mt-2 text-sm leading-6 text-[color:var(--ice-text-secondary)]">
            {description}
          </p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </Panel>
  );
}
