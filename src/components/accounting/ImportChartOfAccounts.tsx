import { useState, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedAccount {
  code: string;
  name: string;
  karakter: string;
  knjizenje: string;
  devizni: boolean;
  pdvCode: string;
}

interface ImportPreview {
  accounts: ParsedAccount[];
  classCounts: Record<string, number>;
  postingAllowed: number;
  postingForbidden: number;
}

function mapAccountType(code: string): string {
  const cls = code.charAt(0);
  if (cls === "0" || cls === "1" || cls === "3") return "asset";
  if (cls === "2") return "liability";
  if (cls === "4") {
    const sub = code.substring(0, 2);
    if (["40", "41", "42"].includes(sub)) return "equity";
    return "liability";
  }
  if (cls === "5" || cls === "9") return "expense";
  if (cls === "6" || cls === "7") return "revenue";
  if (cls === "8") return "equity";
  return "asset";
}

const CLASS_NAMES: Record<string, string> = {
  "0": "Nematerijalna i osnovna sredstva",
  "1": "Zalihe i stalna sredstva",
  "2": "Kratkoročne obaveze i PVR",
  "3": "Gotovina i kratkoročni plasmani",
  "4": "Kapital i dugoročne obaveze",
  "5": "Troškovi",
  "6": "Prihodi",
  "7": "Ostali prihodi i dobici",
  "8": "Vanbilansna evidencija",
  "9": "Obračun troškova",
};

export default function ImportChartOfAccounts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const accounts: ParsedAccount[] = [];
      const classCounts: Record<string, number> = {};
      let postingAllowed = 0;
      let postingForbidden = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        const code = String(row[1] ?? "").trim();
        const name = String(row[2] ?? "").trim();
        if (!code || !name) continue;

        // Validate code is numeric
        if (!/^\d+$/.test(code)) continue;

        const karakter = String(row[4] ?? "").trim();
        const knjizenje = String(row[5] ?? "").trim();
        const devizni = String(row[6] ?? "").toLowerCase() === "true";
        const pdvCode = String(row[13] ?? "").trim();

        accounts.push({ code, name, karakter, knjizenje, devizni, pdvCode });

        const cls = code.charAt(0);
        classCounts[cls] = (classCounts[cls] || 0) + 1;

        if (knjizenje.toLowerCase().includes("dozvoljeno")) postingAllowed++;
        else postingForbidden++;
      }

      if (accounts.length === 0) {
        toast({ title: t("error"), description: "Nije pronađen nijedan konto u fajlu.", variant: "destructive" });
        return;
      }

      setPreview({ accounts, classCounts, postingAllowed, postingForbidden });
      setDialogOpen(true);
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!preview || !tenantId) return;
    setImporting(true);
    setProgress(0);

    try {
      const { accounts } = preview;
      const BATCH = 100;

      // Phase 1: Upsert accounts without parent_id
      setProgressLabel(t("importPhase1") || "Faza 1: Unos konta...");
      const totalBatches = Math.ceil(accounts.length / BATCH);

      for (let i = 0; i < accounts.length; i += BATCH) {
        const batch = accounts.slice(i, i + BATCH);
        const rows = batch.map((a) => {
          const descParts: string[] = [];
          if (a.karakter) descParts.push(`Karakter: ${a.karakter}`);
          if (a.knjizenje) descParts.push(`Knjiženje: ${a.knjizenje}`);
          if (a.devizni) descParts.push("Devizni: Da");
          if (a.pdvCode) descParts.push(`PDV šifra: ${a.pdvCode}`);

          return {
            tenant_id: tenantId,
            code: a.code,
            name: a.name,
            name_sr: a.name,
            account_type: mapAccountType(a.code),
            level: a.code.length,
            is_system: true,
            is_active: true,
            description: descParts.join(", ") || null,
          };
        });

        const { error } = await supabase
          .from("chart_of_accounts")
          .upsert(rows, { onConflict: "tenant_id,code" });

        if (error) throw error;

        const batchNum = Math.floor(i / BATCH) + 1;
        setProgress(Math.round((batchNum / totalBatches) * 50));
      }

      // Phase 2: Resolve parent_id hierarchy
      setProgressLabel(t("importPhase2") || "Faza 2: Povezivanje hijerarhije...");
      setProgress(55);

      // Fetch all accounts for this tenant
      const { data: allAccounts, error: fetchErr } = await supabase
        .from("chart_of_accounts")
        .select("id, code")
        .eq("tenant_id", tenantId);

      if (fetchErr) throw fetchErr;

      const codeToId: Record<string, string> = {};
      for (const a of allAccounts || []) {
        codeToId[a.code] = a.id;
      }

      // Build parent updates
      const updates: { id: string; parent_id: string }[] = [];
      for (const a of allAccounts || []) {
        if (a.code.length <= 1) continue;
        const parentCode = a.code.slice(0, -1);
        const parentId = codeToId[parentCode];
        if (parentId) {
          updates.push({ id: a.id, parent_id: parentId });
        }
      }

      // Batch update parent_id
      for (let i = 0; i < updates.length; i += BATCH) {
        const batch = updates.slice(i, i + BATCH);
        // Use individual updates since upsert on id doesn't set parent_id correctly
        for (const u of batch) {
          await supabase
            .from("chart_of_accounts")
            .update({ parent_id: u.parent_id })
            .eq("id", u.id);
        }
        setProgress(55 + Math.round(((i + BATCH) / updates.length) * 45));
      }

      setProgress(100);
      setProgressLabel(t("importSuccess") || "Uvoz završen!");

      toast({
        title: t("importSuccess") || "Uvoz završen",
        description: `${accounts.length} konta uvezeno, ${updates.length} hijerarhijskih veza postavljeno.`,
      });

      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setTimeout(() => {
        setDialogOpen(false);
        setPreview(null);
        setImporting(false);
        setProgress(0);
      }, 1500);
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
      setImporting(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        {t("importChartOfAccounts") || "Uvezi kontni plan"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!importing) setDialogOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("importPreview") || "Pregled uvoza"}</DialogTitle>
            <DialogDescription>
              {t("importPreviewDesc") || "Pregled konta za uvoz iz Excel fajla"}
            </DialogDescription>
          </DialogHeader>

          {preview && !importing && (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                {t("totalAccounts") || "Ukupno konta"}: {preview.accounts.length}
              </p>
              <div className="space-y-1 ml-2">
                {Object.keys(CLASS_NAMES)
                  .sort()
                  .map((cls) => (
                    <div key={cls} className="flex justify-between text-muted-foreground">
                      <span>
                        Klasa {cls} ({CLASS_NAMES[cls]})
                      </span>
                      <span>{preview.classCounts[cls] || 0}</span>
                    </div>
                  ))}
              </div>
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>{t("postingAllowed") || "Knjiženje dozvoljeno"}</span>
                  <span>{preview.postingAllowed}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("postingForbidden") || "Grupe (zabranjeno)"}</span>
                  <span>{preview.postingForbidden}</span>
                </div>
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{progressLabel}</p>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-right">{progress}%</p>
            </div>
          )}

          {!importing && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={handleImport}>
                {t("importAction") || "Uvezi"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
