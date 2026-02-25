import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, FileText, ClipboardList, Store, UserCheck, BarChart3, Globe, Receipt, DollarSign, Send } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import type { StatItem } from "@/components/shared/StatsBar";

const sections = [
  {
    title: "Dokumenti",
    links: [
      { to: "/sales/quotes", icon: FileText, label: "Ponude", desc: "Kreiranje i slanje ponuda kupcima" },
      { to: "/sales/sales-orders", icon: ClipboardList, label: "Prodajni nalozi", desc: "Upravljanje prodajnim nalozima" },
    ],
  },
  {
    title: "Tim & Učinak",
    links: [
      { to: "/sales/sales-channels", icon: Store, label: "Kanali prodaje", desc: "Konfiguracija prodajnih kanala" },
      { to: "/sales/salespeople", icon: UserCheck, label: "Prodavci", desc: "Evidencija prodajnog osoblja" },
      { to: "/sales/sales-performance", icon: BarChart3, label: "Učinak prodaje", desc: "Analitika prodajnih rezultata" },
    ],
  },
  {
    title: "Web prodaja",
    links: [
      { to: "/sales/web-settings", icon: Globe, label: "Web podešavanja", desc: "Konfiguracija web prodavnice i integracija" },
      { to: "/sales/web-prices", icon: Receipt, label: "Web cene", desc: "Upravljanje cenama za web prodaju" },
    ],
  },
];

export default function SalesHub() {
  const { tenantId } = useTenant();

  const { data: kpi } = useQuery({
    queryKey: ["sales-hub-kpi", tenantId],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [quotes, orders, invoiceSum, sentInvoices] = await Promise.all([
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "draft"),
        supabase.from("sales_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "confirmed"),
        supabase.from("invoices").select("total").eq("tenant_id", tenantId!).gte("invoice_date", monthStart),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "sent"),
      ]);

      const monthRevenue = (invoiceSum.data || []).reduce((s, r) => s + (Number(r.total) || 0), 0);

      return {
        activeQuotes: quotes.count || 0,
        confirmedOrders: orders.count || 0,
        monthRevenue,
        sentInvoices: sentInvoices.count || 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const stats: StatItem[] = kpi
    ? [
        { label: "Aktivne ponude", value: kpi.activeQuotes, icon: FileText, color: "text-primary" },
        { label: "Potvrđeni nalozi", value: kpi.confirmedOrders, icon: ClipboardList, color: "text-accent" },
        { label: "Prihod (mesec)", value: `${(kpi.monthRevenue / 1000).toFixed(0)}k`, icon: DollarSign, color: "text-accent" },
        { label: "Poslate fakture", value: kpi.sentInvoices, icon: Send, color: "text-primary" },
      ]
    : [];

  return (
    <BiPageLayout
      title="Prodaja"
      description="Upravljanje prodajnim aktivnostima — ponude, nalozi, kanali prodaje, web prodaja i analitika učinka."
      icon={TrendingUp}
      stats={stats}
    >
      {tenantId && kpi && (
        <AiAnalyticsNarrative tenantId={tenantId} contextType="sales_performance" data={kpi as unknown as Record<string, unknown>} />
      )}

      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {section.links.map((link) => (
              <Link key={link.to} to={link.to}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="flex flex-col items-center justify-center p-6 gap-3 text-center">
                    <link.icon className="h-8 w-8 text-primary" />
                    <span className="text-sm font-medium">{link.label}</span>
                    <span className="text-xs text-muted-foreground">{link.desc}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </BiPageLayout>
  );
}
