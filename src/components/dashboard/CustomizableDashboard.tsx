import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Settings, Check, ArrowUp, ArrowDown } from "lucide-react";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { WidgetContainer } from "@/components/dashboard/widgets/WidgetContainer";
import { WidgetPickerDialog } from "@/components/dashboard/widgets/WidgetPickerDialog";
import { WidgetRenderer } from "@/components/dashboard/widgets/WidgetRenderer";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

export default function CustomizableDashboard() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const {
    widgets,
    availableWidgets,
    isLoading,
    addWidget,
    removeWidget,
    updateLayout,
    updateConfig,
  } = useDashboardLayout();

  const [editMode, setEditMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...widgets];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      updateLayout(
        reordered.map((w, i) => ({ id: w.id, positionIndex: i })),
      );
    },
    [widgets, updateLayout],
  );

  const handleResize = useCallback(
    (id: string, newWidth: number) => {
      const w = widgets.find((w) => w.id === id);
      if (!w) return;
      updateLayout([{ id, positionIndex: w.positionIndex, width: newWidth }]);
    },
    [widgets, updateLayout],
  );

  const moveWidget = useCallback(
    (id: string, direction: "up" | "down") => {
      const idx = widgets.findIndex((w) => w.id === id);
      if (idx === -1) return;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= widgets.length) return;

      const reordered = [...widgets];
      [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
      updateLayout(reordered.map((w, i) => ({ id: w.id, positionIndex: i })));
    },
    [widgets, updateLayout],
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-12 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="col-span-3 h-28 rounded-lg" />
          ))}
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={`c${i}`} className="col-span-6 h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Mobile: single column, no drag, just up/down arrows
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <WelcomeHeader />
          <div className="flex gap-2">
            {editMode && (
              <WidgetPickerDialog availableWidgets={availableWidgets} onAdd={addWidget} />
            )}
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Check className="h-4 w-4 mr-1" /> : <Settings className="h-4 w-4 mr-1" />}
              {editMode ? t("done") || "Done" : t("customize") || "Customize"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {widgets.map((w, i) => (
            <div key={w.id} className="relative">
              {editMode && (
                <div className="absolute top-1 right-1 z-10 flex gap-1">
                  <button
                    disabled={i === 0}
                    onClick={() => moveWidget(w.id, "up")}
                    className="p-1 rounded bg-muted/80 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={i === widgets.length - 1}
                    onClick={() => moveWidget(w.id, "down")}
                    className="p-1 rounded bg-muted/80 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeWidget(w.id)}
                    className="p-1 rounded bg-destructive/10 text-destructive"
                  >
                    ✕
                  </button>
                </div>
              )}
              <WidgetRenderer widgetConfig={w} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop: 12-column grid with drag-and-drop + resize
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <WelcomeHeader />
        <div className="flex gap-2">
          {editMode && (
            <WidgetPickerDialog availableWidgets={availableWidgets} onAdd={addWidget} />
          )}
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? <Check className="h-4 w-4 mr-1.5" /> : <Settings className="h-4 w-4 mr-1.5" />}
            {editMode ? t("done") || "Done" : t("customize") || "Customize"}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-3" style={{ gridAutoRows: "minmax(120px, auto)" }}>
            {widgets.map((w) => (
              <WidgetContainer
                key={w.id}
                widgetConfig={w}
                editMode={editMode}
                onRemove={removeWidget}
                onUpdateConfig={updateConfig}
                onResize={handleResize}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
