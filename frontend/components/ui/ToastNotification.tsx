"use client";

import { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export type ToastType = "error" | "success" | "info";

type ToastNotificationProps = HTMLAttributes<HTMLDivElement> & {
  type?: ToastType;
  title?: string;
  message: string;
  onClose?: () => void;
};

export default function ToastNotification({
  type = "info",
  title,
  message,
  onClose,
  className,
  ...props
}: ToastNotificationProps) {
  if (!message) return null;

  const isError = type === "error";
  const isSuccess = type === "success";

  const defaultTitle = isError ? "Action Failed" : isSuccess ? "Success" : "Notification";

  return (
    <div
      className={cn(
        "group relative flex items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 text-xs backdrop-blur-2xl transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-2",
        isError
          ? "border-[rgba(255,90,120,0.4)] bg-[linear-gradient(135deg,rgba(42,12,24,0.95),rgba(20,8,16,0.97))] text-white shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(255,80,110,0.25)]"
          : isSuccess
          ? "border-[rgba(110,231,255,0.35)] bg-[linear-gradient(135deg,rgba(12,28,42,0.95),rgba(8,18,30,0.97))] text-white shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(110,231,255,0.22)]"
          : "border-white/10 bg-[linear-gradient(135deg,rgba(20,24,36,0.95),rgba(12,15,24,0.97))] text-ice-primary shadow-[0_12px_40px_rgba(0,0,0,0.5)]",
        className,
      )}
      role="alert"
      {...props}
    >
      {/* Icon Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl font-bold transition duration-300",
            isError
              ? "bg-[rgba(255,80,110,0.2)] text-[#ff6b8b] ring-1 ring-[rgba(255,100,130,0.4)] shadow-[0_0_12px_rgba(255,80,110,0.4)]"
              : isSuccess
              ? "bg-[rgba(110,231,255,0.18)] text-[#6ee7ff] ring-1 ring-[rgba(110,231,255,0.4)] shadow-[0_0_12px_rgba(110,231,255,0.35)]"
              : "bg-white/[0.08] text-ice-muted ring-1 ring-white/15",
          )}
        >
          {isError ? (
            <svg className="h-4 w-4 stroke-current" fill="none" viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
            </svg>
          ) : isSuccess ? (
            <svg className="h-4 w-4 stroke-current" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          ) : (
            <svg className="h-4 w-4 stroke-current" fill="none" viewBox="0 0 24 24">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          )}
        </div>

        <div className="min-w-0">
          <p className="font-bold uppercase tracking-wider text-[11px] opacity-90">
            {title ?? defaultTitle}
          </p>
          <p className="mt-0.5 text-xs leading-snug font-medium text-white/90 truncate-2-lines">
            {message}
          </p>
        </div>
      </div>

      {/* Close Button */}
      {onClose && (
        <button
          aria-label="Close notification"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-white/60 transition duration-150 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
}
