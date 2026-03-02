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

  let toastId: string | number;
  if (variant === "destructive") {
    toastId = sonnerToast.error(message, opts);
  } else {
    toastId = sonnerToast(message, opts);
  }

  return {
    id: String(toastId),
    // CR11-18: Pass toast ID to dismiss
    dismiss: () => sonnerToast.dismiss(toastId),
    // CR11-25: Implement update() via sonner
    update: (updateProps: Partial<ToastProps>) => {
      sonnerToast(updateProps.title || message, {
        id: toastId,
        description: updateProps.description || description,
      });
    },
  };
}

function useToast() {
  return {
    toast,
    // CR12-20: Pass raw id to dismiss — sonner accepts string | number
    dismiss: (id?: string) => sonnerToast.dismiss(id ?? undefined),
    toasts: [] as any[],
  };
}

export { useToast, toast };
