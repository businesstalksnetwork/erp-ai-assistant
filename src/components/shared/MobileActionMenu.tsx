import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface MobileActionMenuProps {
  actions: ActionItem[];
}

export function MobileActionMenu({ actions }: MobileActionMenuProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    // Desktop: inline button group
    return (
      <div className="flex items-center gap-1">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant === "destructive" ? "destructive" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
          >
            {action.icon}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>
    );
  }

  // Mobile: overflow menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            className={action.variant === "destructive" ? "text-destructive" : ""}
          >
            {action.icon}
            <span className="ml-2">{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
