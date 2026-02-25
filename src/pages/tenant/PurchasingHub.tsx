import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, ClipboardList, PackageOpen, FileText, Send, DollarSign } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import type { StatItem } from "@/components/shared/StatsBar";

const links = [
  { to: "/purchasing/orders", icon: ClipboardList, label: "Narudžbenice", desc: "Kreiranje i praćenje narudžbenica dobavljačima" },
  { to: "/purchasing/goods-receipts", icon: PackageOpen, label: "Prijemnice", desc: "Prijem robe i kontrola isporuka" },
  { to: "/purchasing/supplier-invoices", icon: FileText, label: "Ulazne fakture", desc: "Evidencija i knjiženje ulaznih faktura" },
];

export default function PurchasingHub() {
  const { tenantId } = useTenant();

  const { data: kpi } = useQuery({
    queryKey: ["purchasing-hub-kpi", tenantId],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [draftOrders, sentOrders, monthReceipts, monthSum] = await Promise.all([
        supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "draft"),
        supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "sent"),
        supabase.from("goods_receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).gte("receipt_date", monthStart),
        supabase.from("purchase_orders").select("total").eq("tenant_id", tenantId!).gte("order_date", monthStart),
      ]);

      const monthTotal = (monthSum.data || []).reduce((s, r) => s + (Number(r.total) || 0), 0);

      return {
        draftOrders: draftOrders.count || 0,
        sentOrders: sentOrders.count || 0,
        monthReceipts: monthReceipts.count || 0,
        monthTotal,
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const stats: StatItem[] = kpi
    ? [
        { label: "Nacrt narudžbina", value: kpi.draftOrders, icon: ClipboardList, color: "text-primary" },
        { label: "Poslate narudžbine", value: kpi.sentOrders, icon: Send, color: "text-accent" },
        { label: "Prijemnice (mesec)", value: kpi.monthReceipts, icon: PackageOpen, color: "text-primary" },
        { label: "Nabavka (mesec)", value: `${(kpi.monthTotal / 1000).toFixed(0)}k`, icon: DollarSign, color: "text-accent" },
      ]
    : [];

  return (
    <BiPageLayout
      title="Nabavka"
      description="Upravljanje nabavnim procesom — od narudžbenica i prijema robe do evidentiranja ulaznih faktura."
      icon={ShoppingCart}
      stats={stats}
    >
      {tenantId && kpi && (
        <AiAnalyticsNarrative tenantId={tenantId} contextType="purchasing" data={kpi as unknown as Record<string, unknown>} />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
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
    </BiPageLayout>
  );
}
