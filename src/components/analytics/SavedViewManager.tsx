import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Save, Trash2, Share2, Pin, PinOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { usePivotSavedViews, type SavedView } from "@/hooks/usePivotSavedViews";
import type { PivotConfig } from "@/hooks/usePivotConfig";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  config: PivotConfig;
  onLoad: (config: Partial<PivotConfig> & { cube: string }) => void;
}

export function SavedViewManager({ config, onLoad }: Props) {
  const { views, isLoading, saveView, deleteView, toggleShare, togglePin } = usePivotSavedViews();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    saveView.mutate({ name: name.trim(), cube: config.cube, config });
    setName("");
    setOpen(false);
  };

  const handleLoad = (v: SavedView) => {
    onLoad({ cube: v.cube, ...(v.config_json as Partial<PivotConfig>) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sačuvani prikazi</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              <Save className="h-3 w-3 mr-1" /> Sačuvaj
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Sačuvaj prikaz</DialogTitle></DialogHeader>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naziv prikaza..." onKeyDown={(e) => e.key === "Enter" && handleSave()} />
            <DialogFooter>
              <Button onClick={handleSave} disabled={!name.trim() || saveView.isPending}>
                {saveView.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sačuvaj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : views.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nema sačuvanih prikaza</p>
      ) : (
        <ScrollArea className="max-h-40">
          <div className="space-y-1">
            {views.map((v) => (
              <div key={v.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => handleLoad(v)}
                  className="flex-1 text-left text-xs px-2 py-1.5 rounded hover:bg-accent truncate transition-colors"
                >
                  {v.is_pinned && <Pin className="h-3 w-3 inline mr-1 text-primary" />}
                  {v.name}
                </button>
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => togglePin.mutate({ id: v.id, pinned: !v.is_pinned })}>
                    {v.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => toggleShare.mutate({ id: v.id, shared: !v.is_shared })}>
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:text-destructive" onClick={() => deleteView.mutate(v.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
