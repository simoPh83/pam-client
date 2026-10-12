"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";

type ToastVariant = "default" | "success" | "info" | "warning" | "destructive";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss; 0 keeps it until closed. Default 6000. */
  duration?: number;
};

type Toast = ToastInput & { id: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(
  null
);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-border bg-background",
  success: "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40",
  info: "border-sky-400/60 bg-sky-50 dark:bg-sky-950/40",
  warning: "border-amber-500/60 bg-amber-50 dark:bg-amber-950/40",
  destructive: "border-destructive/60 bg-red-50 dark:bg-red-950/40",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-4), { ...input, id }]);
      const duration = input.duration ?? 6000;
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-md border p-3 shadow-md",
              VARIANT_STYLES[t.variant ?? "default"]
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{t.title}</p>
              <button
                type="button"
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => dismiss(t.id)}
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            {t.description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
