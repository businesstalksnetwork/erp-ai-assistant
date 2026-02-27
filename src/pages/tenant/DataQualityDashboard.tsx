import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface ModuleScore {
  module: string;
  label: string;
  totalRecords: number;
  completeRecords: number;
  score: number;
  missingFields: string[];
}

export default function DataQualityDashboard() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";

  const { data: scores, isLoading } = useQuery({
    queryKey: ["data-quality", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const results: ModuleScore[] = [];

      // Partners completeness
      const { data: partners } = await supabase
        .from("partners")
        .select("name, pib, email, phone, address, city")
        .eq("tenant_id", tenantId);
      if (partners && partners.length > 0) {
        const required = ["name", "pib", "email", "phone", "address", "city"] as const;
        let complete = 0;
        const missing = new Set<string>();
        for (const p of partners) {
          const rec = p as Record<string, unknown>;
          const filled = required.filter(f => rec[f] && String(rec[f]).trim().length > 0);
          if (filled.length === required.length) complete++;
          required.forEach(f => { if (!rec[f] || !String(rec[f]).trim()) missing.add(f); });
        }
        results.push({
          module: "partners",
          label: sr ? "Partneri" : "Partners",
          totalRecords: partners.length,
          completeRecords: complete,
          score: Math.round((complete / partners.length) * 100),
          missingFields: Array.from(missing),
        });
      }

      // Products completeness
      const { data: products } = await supabase
        .from("products")
        .select("name, sku, default_sale_price, unit_of_measure, tax_rate_id")
        .eq("tenant_id", tenantId);
      if (products && products.length > 0) {
        const required = ["name", "sku", "default_sale_price", "unit_of_measure", "tax_rate_id"] as const;
        let complete = 0;
        const missing = new Set<string>();
        for (const p of products) {
          const rec = p as Record<string, unknown>;
          const filled = required.filter(f => rec[f] != null && String(rec[f]).trim().length > 0);
          if (filled.length === required.length) complete++;
          required.forEach(f => { if (rec[f] == null || !String(rec[f]).trim()) missing.add(f); });
        }
        results.push({
          module: "products",
          label: sr ? "Proizvodi" : "Products",
          totalRecords: products.length,
          completeRecords: complete,
          score: Math.round((complete / products.length) * 100),
          missingFields: Array.from(missing),
        });
      }

      // Employees completeness
      const { data: employees } = await supabase
        .from("employees")
        .select("first_name, last_name, email, jmbg, position")
        .eq("tenant_id", tenantId);
      if (employees && employees.length > 0) {
        const required = ["first_name", "last_name", "email", "jmbg", "position"] as const;
        let complete = 0;
        const missing = new Set<string>();
        for (const emp of employees) {
          const rec = emp as Record<string, unknown>;
          const filled = required.filter(f => rec[f] && String(rec[f]).trim().length > 0);
          if (filled.length === required.length) complete++;
          required.forEach(f => { if (!rec[f] || !String(rec[f]).trim()) missing.add(f); });
        }
        results.push({
          module: "employees",
          label: sr ? "Zaposleni" : "Employees",
          totalRecords: employees.length,
          completeRecords: complete,
          score: Math.round((complete / employees.length) * 100),
          missingFields: Array.from(missing),
        });
      }

      // Invoices completeness
      const { data: invoices } = await supabase
        .from("invoices")
        .select("invoice_number, partner_name, total, due_date, status")
        .eq("tenant_id", tenantId)
        .limit(500);
      if (invoices && invoices.length > 0) {
        const required = ["invoice_number", "partner_name", "total", "due_date", "status"] as const;
        let complete = 0;
        const missing = new Set<string>();
        for (const inv of invoices) {
          const rec = inv as Record<string, unknown>;
          const filled = required.filter(f => rec[f] != null && String(rec[f]).trim().length > 0);
          if (filled.length === required.length) complete++;
          required.forEach(f => { if (rec[f] == null || !String(rec[f]).trim()) missing.add(f); });
        }
        results.push({
          module: "invoices",
          label: sr ? "Fakture" : "Invoices",
          totalRecords: invoices.length,
          completeRecords: complete,
          score: Math.round((complete / invoices.length) * 100),
          missingFields: Array.from(missing),
        });
      }

      // Assets completeness
      const { data: assets } = await supabase
        .from("assets")
        .select("name, asset_code, acquisition_cost, acquisition_date, category_id, location_id")
        .eq("tenant_id", tenantId);
      if (assets && assets.length > 0) {
        const required = ["name", "asset_code", "acquisition_cost", "acquisition_date", "category_id"] as const;
        let complete = 0;
        const missing = new Set<string>();
        for (const a of assets) {
          const rec = a as Record<string, unknown>;
          const filled = required.filter(f => rec[f] != null && String(rec[f]).trim().length > 0);
          if (filled.length === required.length) complete++;
          required.forEach(f => { if (rec[f] == null || !String(rec[f]).trim()) missing.add(f); });
        }
        results.push({
          module: "assets",
          label: sr ? "Osnovna sredstva" : "Assets",
          totalRecords: assets.length,
          completeRecords: complete,
          score: Math.round((complete / assets.length) * 100),
          missingFields: Array.from(missing),
        });
      }

      return results.sort((a, b) => a.score - b.score);
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  const overallScore = scores && scores.length > 0
    ? Math.round(scores.reduce((s, m) => s + m.score, 0) / scores.length)
    : 0;

  const ScoreIcon = ({ score }: { score: number }) => {
    if (score >= 80) return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (score >= 50) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Kvalitet podataka" : "Data Quality"} />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <>
          {/* Overall score card */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {sr ? "Ukupna ocena kvaliteta" : "Overall Quality Score"}
                  </p>
                  <p className={`text-4xl font-bold ${scoreColor(overallScore)}`}>
                    {overallScore}%
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{scores?.length || 0} {sr ? "modula" : "modules"}</p>
                  <p>{scores?.reduce((s, m) => s + m.totalRecords, 0) || 0} {sr ? "zapisa" : "records"}</p>
                </div>
              </div>
              <Progress value={overallScore} className="mt-4 h-2" />
            </CardContent>
          </Card>

          {/* Module cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(scores || []).map(m => (
              <Card key={m.module}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ScoreIcon score={m.score} />
                      {m.label}
                    </CardTitle>
                    <span className={`text-lg font-bold ${scoreColor(m.score)}`}>{m.score}%</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={m.score} className="h-1.5 mb-3" />
                  <p className="text-xs text-muted-foreground mb-2">
                    {m.completeRecords}/{m.totalRecords} {sr ? "kompletnih" : "complete"}
                  </p>
                  {m.missingFields.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.missingFields.slice(0, 4).map(f => (
                        <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                      ))}
                      {m.missingFields.length > 4 && (
                        <Badge variant="outline" className="text-[10px]">+{m.missingFields.length - 4}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
