import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { widgetCategories, type WidgetDefinition } from "@/config/widgetRegistry";
import { useState } from "react";

interface Props {
  availableWidgets: WidgetDefinition[];
  onAdd: (widgetId: string) => void;
}

export function WidgetPickerDialog({ availableWidgets, onAdd }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const grouped = widgetCategories
    .map((cat) => ({
      ...cat,
      widgets: availableWidgets.filter((w) => w.category === cat.key),
    }))
    .filter((g) => g.widgets.length > 0);

  const firstTab = grouped[0]?.key || "kpi";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> {t("addWidget") || "Add Widget"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addWidget") || "Add Widget"}</DialogTitle>
        </DialogHeader>
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t("noResults") || "All widgets are already on your dashboard."}</p>
        ) : (
          <Tabs defaultValue={firstTab}>
            <TabsList className="w-full">
              {grouped.map((g) => (
                <TabsTrigger key={g.key} value={g.key} className="text-xs">
                  {t(g.labelKey as any) || g.labelKey} ({g.widgets.length})
                </TabsTrigger>
              ))}
            </TabsList>
            {grouped.map((g) => (
              <TabsContent key={g.key} value={g.key} className="space-y-2 mt-3">
                {g.widgets.map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-2 rounded-md border">
                    <span className="text-sm font-medium">{t(w.titleKey as any) || w.titleKey}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onAdd(w.id);
                        setOpen(false);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
