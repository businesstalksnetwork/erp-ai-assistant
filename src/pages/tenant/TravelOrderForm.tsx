import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useToast } from "@/hooks/use-toast";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, Plus, CheckCircle, Banknote, ArrowLeft } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";

const TRANSPORT_TYPES = ["car", "bus", "train", "plane"];
const EXPENSE_TYPES = ["accommodation", "meals", "transport", "other"];
const DOMESTIC_PER_DIEM = 3000;

interface ExpenseLine {
  id?: string;
  expense_type: string;
  description: string;
  amount: number;
  receipt_number: string;
  receipt_date: string;
  sort_order: number;
}

export default function TravelOrderForm() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { entities } = useLegalEntities();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    employee_id: "",
    legal_entity_id: "",
    destination: "",
    purpose: "",
    departure_date: "",
    return_date: "",
    transport_type: "car",
    vehicle_plate: "",
    advance_amount: 0,
    per_diem_rate: DOMESTIC_PER_DIEM,
    notes: "",
    status: "draft",
  });
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);
  const [orderNumber, setOrderNumber] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees_list", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("employees").select("id, first_name, last_name").eq("tenant_id", tenantId).order("last_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: existing } = useQuery({
    queryKey: ["travel_order", id],
    queryFn: async () => {
      if (!id || isNew) return null;
      const { data, error } = await (supabase as any).from("travel_orders").select("*").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !isNew,
  });

  const { data: existingExpenses = [] } = useQuery({
    queryKey: ["travel_order_expenses", id],
    queryFn: async () => {
      if (!id || isNew) return [];
      const { data } = await (supabase as any).from("travel_order_expenses").select("*").eq("travel_order_id", id).order("sort_order");
      return (data || []) as any[];
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (existing) {
      setOrderNumber(existing.order_number || "");
      setForm({
        employee_id: existing.employee_id || "",
        legal_entity_id: existing.legal_entity_id || "",
        destination: existing.destination || "",
        purpose: existing.purpose || "",
        departure_date: existing.departure_date || "",
        return_date: existing.return_date || "",
        transport_type: existing.transport_type || "car",
        vehicle_plate: existing.vehicle_plate || "",
        advance_amount: Number(existing.advance_amount) || 0,
        per_diem_rate: Number(existing.per_diem_rate) || DOMESTIC_PER_DIEM,
        notes: existing.notes || "",
        status: existing.status || "draft",
      });
    }
  }, [existing]);

  useEffect(() => {
    if (existingExpenses.length > 0) {
      setExpenses(existingExpenses.map((e: any) => ({
        id: e.id,
        expense_type: e.expense_type,
        description: e.description || "",
        amount: Number(e.amount),
        receipt_number: e.receipt_number || "",
        receipt_date: e.receipt_date || "",
        sort_order: e.sort_order,
      })));
    }
  }, [existingExpenses]);

  const perDiemDays = useMemo(() => {
    if (!form.departure_date || !form.return_date) return 0;
    return Math.max(differenceInCalendarDays(new Date(form.return_date), new Date(form.departure_date)) + 1, 0);
  }, [form.departure_date, form.return_date]);

  const perDiemTotal = perDiemDays * form.per_diem_rate;
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const grandTotal = perDiemTotal + expenseTotal;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload: any = {
        tenant_id: tenantId,
        employee_id: form.employee_id || null,
        legal_entity_id: form.legal_entity_id || null,
        destination: form.destination,
        purpose: form.purpose,
        departure_date: form.departure_date,
        return_date: form.return_date,
        transport_type: form.transport_type,
        vehicle_plate: form.vehicle_plate || null,
        advance_amount: form.advance_amount,
        per_diem_rate: form.per_diem_rate,
        per_diem_days: perDiemDays,
        per_diem_total: perDiemTotal,
        total_expenses: grandTotal,
        status: form.status,
        notes: form.notes || null,
      };

      let orderId: string;
      if (isNew) {
        payload.created_by = user?.id || null;
        const { data, error } = await (supabase as any).from("travel_orders").insert(payload).select("id").single();
        if (error) throw error;
        orderId = data.id;
      } else {
        const { error } = await (supabase as any).from("travel_orders").update(payload).eq("id", id);
        if (error) throw error;
        orderId = id!;
      }

      if (!isNew) {
        await (supabase as any).from("travel_order_expenses").delete().eq("travel_order_id", orderId);
      }
      if (expenses.length > 0) {
        const expPayload = expenses.map((e, i) => ({
          travel_order_id: orderId,
          tenant_id: tenantId,
          expense_type: e.expense_type,
          description: e.description || null,
          amount: e.amount,
          receipt_number: e.receipt_number || null,
          receipt_date: e.receipt_date || null,
          sort_order: i,
        }));
        const { error } = await (supabase as any).from("travel_order_expenses").insert(expPayload);
        if (error) throw error;
      }
      return orderId;
    },
    onSuccess: (orderId) => {
      toast({ title: t("saved") });
      queryClient.invalidateQueries({ queryKey: ["travel_orders"] });
      if (isNew) navigate(`/hr/travel-orders/${orderId}`, { replace: true });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !id) throw new Error("Missing data");
      const journalId = await postWithRuleOrFallback({
        tenantId,
        userId: user?.id || null,
        modelCode: "TRAVEL_ORDER_POST",
        amount: grandTotal,
        entryDate: form.return_date || new Date().toISOString().slice(0, 10),
        description: `Putni nalog ${orderNumber} — ${form.destination}`,
        reference: orderNumber,
        legalEntityId: form.legal_entity_id || undefined,
        context: {},
        fallbackLines: [
          { accountCode: "5210", debit: grandTotal, credit: 0, description: "Troškovi putovanja", sortOrder: 1 },
          { accountCode: form.advance_amount > 0 ? "2410" : "2040", debit: 0, credit: grandTotal, description: form.advance_amount > 0 ? "Obračun avansa" : "Obaveze prema zaposlenom", sortOrder: 2 },
        ],
      });
      await (supabase as any).from("travel_orders").update({ status: "settled", journal_entry_id: journalId }).eq("id", id);
    },
    onSuccess: () => {
      toast({ title: t("posted") });
      queryClient.invalidateQueries({ queryKey: ["travel_order", id] });
      queryClient.invalidateQueries({ queryKey: ["travel_orders"] });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const addExpenseLine = () => setExpenses(prev => [...prev, { expense_type: "other", description: "", amount: 0, receipt_number: "", receipt_date: "", sort_order: prev.length }]);
  const removeExpense = (idx: number) => setExpenses(prev => prev.filter((_, i) => i !== idx));
  const updateExpense = (idx: number, field: string, value: any) => setExpenses(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const isSettled = form.status === "settled";
  const travelLabel = (key: string) => (t as any)(key) || key;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/hr/travel-orders")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{isNew ? travelLabel("newTravelOrder") : `${travelLabel("travelOrder")} ${orderNumber}`}</h1>
        {!isNew && <Badge className={form.status === "settled" ? "bg-emerald-100 text-emerald-800" : ""}>{travelLabel(form.status)}</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle>{t("details")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t("employee")}</Label>
            <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))} disabled={isSettled}>
              <SelectTrigger><SelectValue placeholder={travelLabel("selectEmployee")} /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("legalEntity")}</Label>
            <Select value={form.legal_entity_id} onValueChange={v => setForm(f => ({ ...f, legal_entity_id: v }))} disabled={isSettled}>
              <SelectTrigger><SelectValue placeholder={travelLabel("selectLegalEntity")} /></SelectTrigger>
              <SelectContent>
                {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{travelLabel("destination")}</Label>
            <Input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} disabled={isSettled} />
          </div>
          <div>
            <Label>{travelLabel("purpose")}</Label>
            <Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} disabled={isSettled} />
          </div>
          <div>
            <Label>{travelLabel("departureDate")}</Label>
            <Input type="date" value={form.departure_date} onChange={e => setForm(f => ({ ...f, departure_date: e.target.value }))} disabled={isSettled} />
          </div>
          <div>
            <Label>{travelLabel("returnDate")}</Label>
            <Input type="date" value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} disabled={isSettled} />
          </div>
          <div>
            <Label>{travelLabel("transportType")}</Label>
            <Select value={form.transport_type} onValueChange={v => setForm(f => ({ ...f, transport_type: v }))} disabled={isSettled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSPORT_TYPES.map(tt => <SelectItem key={tt} value={tt}>{travelLabel(tt)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{travelLabel("vehiclePlate")}</Label>
            <Input value={form.vehicle_plate} onChange={e => setForm(f => ({ ...f, vehicle_plate: e.target.value }))} disabled={isSettled} />
          </div>
          <div>
            <Label>{travelLabel("advanceAmount")}</Label>
            <Input type="number" value={form.advance_amount} onChange={e => setForm(f => ({ ...f, advance_amount: Number(e.target.value) }))} disabled={isSettled} />
          </div>
          <div>
            <Label>{travelLabel("perDiemRate")} (RSD)</Label>
            <Input type="number" value={form.per_diem_rate} onChange={e => setForm(f => ({ ...f, per_diem_rate: Number(e.target.value) }))} disabled={isSettled} />
          </div>
          <div className="md:col-span-2">
            <Label>{t("notes")}</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} disabled={isSettled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{travelLabel("perDiemCalculation")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">{t("days")}:</span> <strong>{perDiemDays}</strong></div>
            <div><span className="text-muted-foreground">{travelLabel("perDiemRate")}:</span> <strong>{form.per_diem_rate.toLocaleString("sr-RS")} RSD</strong></div>
            <div><span className="text-muted-foreground">{travelLabel("perDiemTotal")}:</span> <strong>{perDiemTotal.toLocaleString("sr-RS")} RSD</strong></div>
            <div><span className="text-muted-foreground">{t("total")}:</span> <strong className="text-primary">{grandTotal.toLocaleString("sr-RS")} RSD</strong></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("expenses")}</CardTitle>
          {!isSettled && <Button variant="outline" size="sm" onClick={addExpenseLine}><Plus className="h-4 w-4 mr-1" />{travelLabel("addLine")}</Button>}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{travelLabel("receiptNumber")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">{t("noDataToExport")}</TableCell></TableRow>
              ) : expenses.map((exp, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={exp.expense_type} onValueChange={v => updateExpense(i, "expense_type", v)} disabled={isSettled}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_TYPES.map(et => <SelectItem key={et} value={et}>{travelLabel(et)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={exp.description} onChange={e => updateExpense(i, "description", e.target.value)} disabled={isSettled} /></TableCell>
                  <TableCell><Input type="number" className="w-[120px]" value={exp.amount} onChange={e => updateExpense(i, "amount", Number(e.target.value))} disabled={isSettled} /></TableCell>
                  <TableCell><Input value={exp.receipt_number} onChange={e => updateExpense(i, "receipt_number", e.target.value)} disabled={isSettled} /></TableCell>
                  <TableCell><Input type="date" value={exp.receipt_date} onChange={e => updateExpense(i, "receipt_date", e.target.value)} disabled={isSettled} /></TableCell>
                  <TableCell>{!isSettled && <Button variant="ghost" size="icon" onClick={() => removeExpense(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                </TableRow>
              ))}
              {expenses.length > 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-semibold">{travelLabel("expenseTotal")}:</TableCell>
                  <TableCell className="font-mono font-bold">{expenseTotal.toLocaleString("sr-RS")}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        {!isSettled && (
          <>
            <Button variant="outline" onClick={() => navigate("/hr/travel-orders")}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.destination || !form.departure_date || !form.return_date}>
              <Save className="h-4 w-4 mr-2" />{t("save")}
            </Button>
          </>
        )}
        {!isNew && form.status === "approved" && (
          <Button variant="default" onClick={() => settleMutation.mutate()} disabled={settleMutation.isPending}>
            <Banknote className="h-4 w-4 mr-2" />{travelLabel("settleAndPost")}
          </Button>
        )}
        {!isNew && form.status === "draft" && (
          <Button variant="default" onClick={async () => {
            await (supabase as any).from("travel_orders").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", id);
            setForm(f => ({ ...f, status: "approved" }));
            queryClient.invalidateQueries({ queryKey: ["travel_order", id] });
            toast({ title: t("approved") });
          }}>
            <CheckCircle className="h-4 w-4 mr-2" />{t("approve")}
          </Button>
        )}
      </div>
    </div>
  );
}
