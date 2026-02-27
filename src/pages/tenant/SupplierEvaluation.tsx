import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ClipboardCheck, Plus, Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend,
} from "recharts";

export default function SupplierEvaluation() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [scores, setScores] = useState({ quality: 5, delivery: 5, price: 5, service: 5 });
  const [weights, setWeights] = useState({ quality: 30, delivery: 25, price: 25, service: 20 });
  const [notes, setNotes] = useState("");

  const { data: partners } = useQuery({
    queryKey: ["partners-suppliers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!);
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-evaluations", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: evals } = await (supabase
        .from("supplier_evaluations")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("evaluation_date", { ascending: false }) as any);
      return (evals || []) as any[];
    },
  });

  const partnerMap = useMemo(() => new Map((partners || []).map(p => [p.id, p.name])), [partners]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split("T")[0];
      const periodEnd = now.toISOString().split("T")[0];
      const { error } = await (supabase.from("supplier_evaluations").insert({
        tenant_id: tenantId!,
        partner_id: partnerId,
        period_start: periodStart,
        period_end: periodEnd,
        quality_score: scores.quality,
        delivery_score: scores.delivery,
        price_score: scores.price,
        service_score: scores.service,
        quality_weight: weights.quality / 100,
        delivery_weight: weights.delivery / 100,
        price_weight: weights.price / 100,
        service_weight: weights.service / 100,
        notes,
      }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Evaluation saved", "Evaluacija sačuvana"));
      qc.invalidateQueries({ queryKey: ["supplier-evaluations"] });
      setOpen(false);
      setPartnerId("");
      setNotes("");
      setScores({ quality: 5, delivery: 5, price: 5, service: 5 });
    },
    onError: () => toast.error(t("Failed to save", "Greška pri čuvanju")),
  });

  // Aggregate latest eval per supplier
  const latestBySupplier = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of data || []) {
      if (!map.has(e.partner_id)) map.set(e.partner_id, e);
    }
    return Array.from(map.values()).sort((a, b) => Number(b.weighted_score) - Number(a.weighted_score));
  }, [data]);

  // Trend data: group by partner, sort by date
  const trendData = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of data || []) {
      if (!map.has(e.partner_id)) map.set(e.partner_id, []);
      map.get(e.partner_id)!.push(e);
    }
    return map;
  }, [data]);

  const comparisonChart = latestBySupplier.slice(0, 10).map(e => ({
    name: (partnerMap.get(e.partner_id) || "?").substring(0, 18),
    quality: Number(e.quality_score),
    delivery: Number(e.delivery_score),
    price: Number(e.price_score),
    service: Number(e.service_score),
    weighted: Number(e.weighted_score),
  }));

  const selectedRadar = latestBySupplier[0];
  const radarData = selectedRadar ? [
    { dim: t("Quality", "Kvalitet"), score: Number(selectedRadar.quality_score) },
    { dim: t("Delivery", "Isporuka"), score: Number(selectedRadar.delivery_score) },
    { dim: t("Price", "Cena"), score: Number(selectedRadar.price_score) },
    { dim: t("Service", "Usluga"), score: Number(selectedRadar.service_score) },
  ] : [];

  const scoreColor = (s: number) => s >= 7 ? "text-green-600" : s >= 4 ? "text-yellow-600" : "text-destructive";
  const scoreBadge = (s: number) => s >= 7 ? "default" : s >= 4 ? "secondary" : "destructive";

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={t("Supplier Evaluation", "Evaluacija dobavljača")} icon={ClipboardCheck} />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("New Evaluation", "Nova evaluacija")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("Evaluate Supplier", "Oceni dobavljača")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("Supplier", "Dobavljač")}</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder={t("Select…", "Izaberi…")} /></SelectTrigger>
                  <SelectContent>
                    {(partners || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(["quality", "delivery", "price", "service"] as const).map(dim => (
                <div key={dim} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{t(dim, dim === "quality" ? "Kvalitet" : dim === "delivery" ? "Isporuka" : dim === "price" ? "Cena" : "Usluga")}</span>
                    <span className="font-mono font-bold">{scores[dim]}/10</span>
                  </div>
                  <Slider
                    min={0} max={10} step={0.5}
                    value={[scores[dim]]}
                    onValueChange={([v]) => setScores(s => ({ ...s, [dim]: v }))}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("Weight", "Težina")}: {weights[dim]}%</span>
                  </div>
                </div>
              ))}
              <div>
                <Label>{t("Notes", "Napomene")}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!partnerId || saveMutation.isPending} className="w-full">
                {t("Save Evaluation", "Sačuvaj evaluaciju")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">{t("Evaluated Suppliers", "Ocenjeni dobavljači")}</p>
          <p className="text-2xl font-bold mt-1">{latestBySupplier.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">{t("Avg Weighted Score", "Prosečan skor")}</p>
          <p className="text-2xl font-bold mt-1">
            {latestBySupplier.length ? (latestBySupplier.reduce((s, e) => s + Number(e.weighted_score), 0) / latestBySupplier.length).toFixed(1) : "—"}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">{t("Top Performer", "Najbolji")}</p>
          <p className="text-lg font-bold mt-1 truncate">{latestBySupplier[0] ? partnerMap.get(latestBySupplier[0].partner_id) || "—" : "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">{t("At Risk (<4)", "Rizičan (<4)")}</p>
          <p className={`text-2xl font-bold mt-1 ${latestBySupplier.filter(e => Number(e.weighted_score) < 4).length > 0 ? "text-destructive" : ""}`}>
            {latestBySupplier.filter(e => Number(e.weighted_score) < 4).length}
          </p>
        </CardContent></Card>
      </div>

      {/* Comparison bar chart */}
      {comparisonChart.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("Supplier Comparison", "Poređenje dobavljača")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 10]} className="text-xs" />
                <YAxis dataKey="name" type="category" width={130} className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="quality" fill="hsl(var(--primary))" name={t("Quality", "Kvalitet")} stackId="a" />
                <Bar dataKey="delivery" fill="hsl(var(--accent))" name={t("Delivery", "Isporuka")} stackId="b" />
                <Bar dataKey="weighted" fill="hsl(var(--secondary))" name={t("Weighted", "Ponderisan")} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Radar for top supplier */}
      {radarData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("Top Supplier Profile", "Profil najboljeg")} — {partnerMap.get(selectedRadar.partner_id)}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dim" className="text-xs" />
                  <PolarRadiusAxis domain={[0, 10]} />
                  <Radar dataKey="score" fill="hsl(var(--primary))" fillOpacity={0.4} stroke="hsl(var(--primary))" />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trend chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("Score Trends", "Trendovi ocena")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="evaluation_date" className="text-xs" />
                  <YAxis domain={[0, 10]} className="text-xs" />
                  <Tooltip />
                  <Legend />
                  {Array.from(trendData.entries()).slice(0, 5).map(([pid, evals], i) => (
                    <Line
                      key={pid}
                      data={[...evals].reverse()}
                      dataKey="weighted_score"
                      name={(partnerMap.get(pid) || "?").substring(0, 15)}
                      stroke={`hsl(${i * 60}, 60%, 50%)`}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Supplier Ranking", "Rangiranje dobavljača")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">{t("Supplier", "Dobavljač")}</th>
                  <th className="pb-2 pr-4 text-center">{t("Quality", "Kvalitet")}</th>
                  <th className="pb-2 pr-4 text-center">{t("Delivery", "Isporuka")}</th>
                  <th className="pb-2 pr-4 text-center">{t("Price", "Cena")}</th>
                  <th className="pb-2 pr-4 text-center">{t("Service", "Usluga")}</th>
                  <th className="pb-2 text-center">{t("Weighted", "Ponderisan")}</th>
                </tr>
              </thead>
              <tbody>
                {latestBySupplier.map((e, i) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium">{partnerMap.get(e.partner_id) || "—"}</td>
                    <td className={`py-2 pr-4 text-center ${scoreColor(Number(e.quality_score))}`}>{Number(e.quality_score).toFixed(1)}</td>
                    <td className={`py-2 pr-4 text-center ${scoreColor(Number(e.delivery_score))}`}>{Number(e.delivery_score).toFixed(1)}</td>
                    <td className={`py-2 pr-4 text-center ${scoreColor(Number(e.price_score))}`}>{Number(e.price_score).toFixed(1)}</td>
                    <td className={`py-2 pr-4 text-center ${scoreColor(Number(e.service_score))}`}>{Number(e.service_score).toFixed(1)}</td>
                    <td className="py-2 text-center">
                      <Badge variant={scoreBadge(Number(e.weighted_score)) as any}>{Number(e.weighted_score).toFixed(1)}</Badge>
                    </td>
                  </tr>
                ))}
                {latestBySupplier.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{t("No evaluations yet", "Nema evaluacija")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
