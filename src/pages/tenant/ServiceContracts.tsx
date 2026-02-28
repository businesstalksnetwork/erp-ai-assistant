import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, FileSignature, Search } from "lucide-react";

export default function ServiceContracts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Form state
  const [contractNumber, setContractNumber] = useState("");
  const [title, setTitle] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [slaResponse, setSlaResponse] = useState("24");
  const [slaResolution, setSlaResolution] = useState("72");
  const [contractType, setContractType] = useState("standard");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [notes, setNotes] = useState("");

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["service-contracts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_contracts")
        .select("*, partners(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-for-contracts", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).order("name").limit(500);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_contracts").insert({
        tenant_id: tenantId!,
        contract_number: contractNumber,
        title,
        partner_id: partnerId || null,
        start_date: startDate,
        end_date: endDate || null,
        sla_response_hours: Number(slaResponse),
        sla_resolution_hours: Number(slaResolution),
        contract_type: contractType,
        monthly_fee: Number(monthlyFee) || 0,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("save") + " ✓");
      qc.invalidateQueries({ queryKey: ["service-contracts"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setContractNumber("");
    setTitle("");
    setPartnerId("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setSlaResponse("24");
    setSlaResolution("72");
    setContractType("standard");
    setMonthlyFee("");
    setNotes("");
  };

  const filtered = contracts.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.contract_number?.toLowerCase().includes(s) || c.title?.toLowerCase().includes(s) || c.partners?.name?.toLowerCase().includes(s);
  });

  const slaIndicator = (hours: number) => {
    if (hours <= 8) return <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">{hours}h</Badge>;
    if (hours <= 24) return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 text-xs">{hours}h</Badge>;
    return <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs">{hours}h</Badge>;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("serviceContracts" as any) || "Service Contracts"}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />{t("newServiceOrder")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("serviceContracts" as any) || "New Contract"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("number" as any) || "#"}</Label>
                  <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="SVC-001" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("contractType" as any) || "Type"}</Label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("name")}</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("partner" as any) || "Partner"}</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder={t("select" as any) || "Select..."} /></SelectTrigger>
                  <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("startDate" as any) || "Start"}</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("endDate" as any) || "End"}</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>SLA {t("slaResponseHours" as any) || "Response (h)"}</Label>
                  <Input type="number" value={slaResponse} onChange={e => setSlaResponse(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>SLA {t("slaResolutionHours" as any) || "Resolution (h)"}</Label>
                  <Input type="number" value={slaResolution} onChange={e => setSlaResolution(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("monthlyFee" as any) || "Fee/mo"}</Label>
                  <Input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("notes" as any) || "Notes"}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!contractNumber || !title || createMutation.isPending}>
                {t("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">{t("name")}</th>
              <th className="px-4 py-3 text-left">{t("partner" as any)}</th>
              <th className="px-4 py-3 text-left">{t("contractType" as any) || "Type"}</th>
              <th className="px-4 py-3 text-center">SLA ⏱</th>
              <th className="px-4 py-3 text-right">{t("monthlyFee" as any) || "Fee"}</th>
              <th className="px-4 py-3 text-left">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("noResults")}</td></tr>
            ) : filtered.map((c: any) => {
              const isExpired = c.end_date && new Date(c.end_date) < new Date();
              return (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{c.contract_number}</td>
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3">{c.partners?.name || "—"}</td>
                  <td className="px-4 py-3 capitalize">{c.contract_type}</td>
                  <td className="px-4 py-3 text-center space-x-1">
                    {slaIndicator(c.sla_response_hours)} {slaIndicator(c.sla_resolution_hours)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(c.monthly_fee).toLocaleString("sr-RS")}</td>
                  <td className="px-4 py-3">
                    {isExpired ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs">{t("expired" as any) || "Expired"}</Badge>
                    ) : c.is_active ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">{t("active")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">{t("inactive" as any) || "Inactive"}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
