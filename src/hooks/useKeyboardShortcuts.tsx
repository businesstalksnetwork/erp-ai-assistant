import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const NEW_ENTITY_ROUTES: Record<string, string> = {
  "/accounting/invoices": "/accounting/invoices/new",
  "/crm/companies": "/crm/companies",
  "/crm/contacts": "/crm/contacts",
  "/crm/leads": "/crm/leads",
  "/inventory/products": "/inventory/products",
  "/sales/quotes": "/sales/quotes",
  "/purchasing/orders": "/purchasing/orders",
  "/assets/registry": "/assets/registry/new",
};

interface ShortcutDef {
  keys: string;
  label: string;
  category: string;
}

const SHORTCUT_LIST: ShortcutDef[] = [
  { keys: "Ctrl+K", label: "Global Search", category: "Navigation" },
  { keys: "Ctrl+N", label: "New Entity", category: "Actions" },
  { keys: "Ctrl+S", label: "Save", category: "Actions" },
  { keys: "Ctrl+Enter", label: "Post / Confirm", category: "Actions" },
  { keys: "Escape", label: "Close Dialog / Cancel", category: "Actions" },
  { keys: "Shift+?", label: "Show Shortcuts", category: "Help" },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showOverlay, setShowOverlay] = useState(false);

  const handler = useCallback((e: KeyboardEvent) => {
    // Don't trigger in inputs/textareas
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    // Shift+? = Show shortcuts overlay
    if (e.key === "?" && e.shiftKey) {
      e.preventDefault();
      setShowOverlay((v) => !v);
      return;
    }

    // Escape = Close dialog / cancel
    if (e.key === "Escape") {
      const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="cancel"]');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
      return;
    }

    // Ctrl+N = New entity (if current page supports it)
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      const newRoute = NEW_ENTITY_ROUTES[location.pathname];
      if (newRoute) {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="new"]');
        if (btn) btn.click();
        else navigate(newRoute);
      }
    }

    // Ctrl+S = Save (trigger form submit)
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="save"]');
      if (btn) btn.click();
    }

    // Ctrl+Enter = Post/Confirm
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="confirm"]');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);

  return { showOverlay, setShowOverlay };
}

export function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const categories = [...new Set(SHORTCUT_LIST.map((s) => s.category))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{cat}</h4>
              <div className="space-y-1">
                {SHORTCUT_LIST.filter((s) => s.category === cat).map((s) => (
                  <div key={s.keys} className="flex items-center justify-between py-1">
                    <span className="text-sm">{s.label}</span>
                    <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
