import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const NEW_ENTITY_ROUTES: Record<string, string> = {
  "/accounting/invoices": "/accounting/invoices/new",
  "/crm/companies": "/crm/companies",
  "/crm/contacts": "/crm/contacts",
  "/crm/leads": "/crm/leads",
  "/inventory/products": "/inventory/products",
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Ctrl+N = New entity (if current page supports it)
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        const newRoute = NEW_ENTITY_ROUTES[location.pathname];
        if (newRoute) {
          e.preventDefault();
          // Click the first "new" button on the page
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
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate, location.pathname]);
}
