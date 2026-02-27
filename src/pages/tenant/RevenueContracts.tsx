import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { Plus, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";

interface RevenueContract {
  id: string;
  contract_number: string;
  customer_name: string | null;
  description: string | null;
  contract_date: string;
  total_transaction_price: number;
  status: string;
  step5_recognition_method: string;
  currency: string;
}

export default function RevenueContracts() {
  const { tenantId } = useTenant();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const sr = locale === "sr";

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["revenue-contracts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_contracts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RevenueContract[];
    },
    enabled: !!tenantId,
  });

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase();
    return !q || c.contract_number?.toLowerCase().includes(q) || c.customer_name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
  });

  const statusVariant = (s: string) => s === "active" ? "default" as const : s === "completed" ? "secondary" as const : s === "cancelled" ? "destructive" as const : "outline" as const;
  const statusLabel: Record<string, string> = { draft: sr ? "Nacrt" : "Draft", active: sr ? "Aktivan" : "Active", completed: sr ? "Završen" : "Completed", cancelled: sr ? "Otkazan" : "Cancelled" };
  const methodLabel: Record<string, string> = {
    point_in_time: sr ? "U trenutku" : "Point in time",
    over_time_output: sr ? "Tokom vrem. (output)" : "Over time (output)",
    over_time_input: sr ? "Tokom vrem. (input)" : "Over time (input)",
    over_time_cost: sr ? "Tokom vrem. (trošak)" : "Over time (cost)",
  };

  const columns: ResponsiveColumn<RevenueContract>[] = [
    { key: "contract_number", label: sr ? "Ugovor" : "Contract", sortable: true, render: (r) => <span className="font-mono font-semibold">{r.contract_number}</span> },
    { key: "customer_name", label: sr ? "Kupac" : "Customer", sortable: true, render: (r) => r.customer_name || "—" },
    { key: "contract_date", label: sr ? "Datum" : "Date", sortable: true, sortValue: (r) => r.contract_date, render: (r) => format(new Date(r.contract_date), "dd.MM.yyyy") },
    { key: "total_transaction_price", label: sr ? "Cena transakcije" : "Transaction Price", sortable: true, align: "right", render: (r) => `${fmtNum(r.total_transaction_price)} ${r.currency}` },
    { key: "step5_recognition_method", label: sr ? "Metod" : "Method", hideOnMobile: true, render: (r) => <Badge variant="outline">{methodLabel[r.step5_recognition_method] || r.step5_recognition_method}</Badge> },
    { key: "status", label: "Status", sortable: true, render: (r) => <Badge variant={statusVariant(r.status)}>{statusLabel[r.status] || r.status}</Badge> },
  ];

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{sr ? "IFRS 15 — Priznavanje prihoda" : "IFRS 15 — Revenue Recognition"}</h1>
          <p className="text-muted-foreground text-sm">{sr ? "Ugovori sa kupcima — 5-step model" : "Customer contracts — 5-step model"}</p>
        </div>
        <Button onClick={() => navigate("/accounting/revenue-contracts/new")}>
          <Plus className="h-4 w-4 mr-2" /> {sr ? "Novi ugovor" : "New Contract"}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={sr ? "Pretraga..." : "Search..."} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">{sr ? "Učitavanje..." : "Loading..."}</p>
      ) : (
        <ResponsiveTable
          data={filtered}
          columns={columns}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => navigate(`/accounting/revenue-contracts/${r.id}`)}
          emptyMessage={sr ? "Nema ugovora" : "No contracts"}
        />
      )}
    </div>
  );
}
