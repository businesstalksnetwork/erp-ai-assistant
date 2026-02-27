import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { WidgetConfig } from "@/hooks/useDashboardLayout";
import { WidgetRenderer } from "./WidgetRenderer";
import { WidgetShortcutEditor } from "./WidgetShortcutEditor";
import { RetailLocationPicker } from "./RetailLocationPicker";
import { WIDGET_WIDTH_OPTIONS } from "@/config/widgetRegistry";

const CONFIGURABLE_WIDGETS = new Set(["quick_actions"]);
const RETAIL_WIDGET_PREFIXES = ["kpi_retail_", "kpi_pos_sessions_active", "kpi_avg_basket", "kpi_retail_transactions"];

function isRetailWidget(widgetId: string): boolean {
  return RETAIL_WIDGET_PREFIXES.some((p) => widgetId.startsWith(p));
}

interface Props {
  widgetConfig: WidgetConfig;
  editMode: boolean;
  onRemove: (id: string) => void;
  onUpdateConfig?: (id: string, configJson: Record<string, any>) => void;
  onResize?: (id: string, width: number) => void;
}

export function WidgetContainer({ widgetConfig, editMode, onRemove, onUpdateConfig, onResize }: Props) {
  const { t } = useLanguage();
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
    ...(widgetConfig.height > 1 ? { gridRow: `span ${widgetConfig.height}` } : {}),
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
          {isRetailWidget(widgetConfig.widgetId) && onUpdateConfig && (
            <RetailLocationPicker widgetConfig={widgetConfig} onUpdateConfig={onUpdateConfig} />
          )}
          {/* Width resize buttons */}
          {onResize && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 flex gap-0.5 bg-muted/90 rounded-md p-0.5">
              {WIDGET_WIDTH_OPTIONS.map((opt) => (
                <button
                  key={opt.cols}
                  onClick={() => onResize(widgetConfig.id, opt.cols)}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                    widgetConfig.width === opt.cols
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted-foreground/10"
                  )}
                  title={`${t("widgetSize" as any) || "Size"}: ${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <WidgetRenderer widgetConfig={widgetConfig} />
    </div>
  );
}
