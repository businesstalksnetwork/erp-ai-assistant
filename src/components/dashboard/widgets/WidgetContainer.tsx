import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetConfig } from "@/hooks/useDashboardLayout";
import { WidgetRenderer } from "./WidgetRenderer";
import { WidgetShortcutEditor } from "./WidgetShortcutEditor";

const CONFIGURABLE_WIDGETS = new Set(["quick_actions"]);

interface Props {
  widgetConfig: WidgetConfig;
  editMode: boolean;
  onRemove: (id: string) => void;
  onUpdateConfig?: (id: string, configJson: Record<string, any>) => void;
}

export function WidgetContainer({ widgetConfig, editMode, onRemove, onUpdateConfig }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widgetConfig.id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${widgetConfig.width}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative min-h-[120px]",
        isDragging && "z-50 opacity-75",
        editMode && "ring-1 ring-dashed ring-border rounded-lg",
      )}
      {...attributes}
    >
      {editMode && (
        <>
          <button
            {...listeners}
            className="absolute top-1 left-1 z-10 p-1 rounded bg-muted/80 cursor-grab active:cursor-grabbing hover:bg-muted"
            aria-label="Drag"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => onRemove(widgetConfig.id)}
            className="absolute top-1 right-1 z-10 p-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive"
            aria-label="Remove"
          >
           <X className="h-3.5 w-3.5" />
          </button>
          {CONFIGURABLE_WIDGETS.has(widgetConfig.widgetId) && onUpdateConfig && (
            <WidgetShortcutEditor widgetConfig={widgetConfig} onUpdateConfig={onUpdateConfig} />
          )}
        </>
      )}
      <WidgetRenderer widgetConfig={widgetConfig} />
    </div>
  );
}
