/**
 * CR10-24: Unified toast system.
 * 
 * This shim bridges the old shadcn useToast() API to sonner's toast(),
 * ensuring a single toast system (Sonner) is used throughout the app.
 * 
 * Components can continue using:
 *   const { toast } = useToast();
 *   toast({ title: "...", description: "..." });
 * 
 * Under the hood, this delegates to sonner's toast().
 */
import { toast as sonnerToast } from "sonner";
import * as React from "react";

interface ToastProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
}

function toast(props: ToastProps) {
  const { title, description, variant } = props;
  const message = title || "";
  const opts: any = {};
  if (description) opts.description = description;

  if (variant === "destructive") {
    sonnerToast.error(message, opts);
  } else {
    sonnerToast(message, opts);
  }

  return {
    id: String(Date.now()),
    dismiss: () => sonnerToast.dismiss(),
    update: () => {},
  };
}

function useToast() {
  return {
    toast,
    dismiss: (id?: string) => sonnerToast.dismiss(id ? Number(id) : undefined),
    toasts: [] as any[],
  };
}

export { useToast, toast };
