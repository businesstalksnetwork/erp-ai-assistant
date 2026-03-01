import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, AlertTriangle } from "lucide-react";

function validateIBAN(iban: string): boolean {
  if (!iban) return false;
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  return /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned);
}

function generatePain001(orders: any[], initiatorName: string, initiatorIBAN: string, initiatorBIC: string): string {
  const msgId = `MSG-${Date.now()}`;
  const creationDate = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const nbOfTxs = orders.length;
  const ctrlSum = orders.reduce((s: number, o: any) => s + Number(o.amount), 0).toFixed(2);
  const requestedDate = new Date().toISOString().split("T")[0];

  const txns = orders.map((o: any, idx: number) => {
    const recipientIBAN = (o.recipient_iban || o.recipient_account || "").replace(/\s/g, "").toUpperCase();
    const recipientBIC = o.recipient_bic || "NOTPROVIDED";
    const recipientName = o.recipient_name || o.partner_name || `Recipient ${idx + 1}`;
    return `
        <CdtTrfTxInf>
          <PmtId><EndToEndId>${o.payment_order_number || o.id.slice(0, 16)}</EndToEndId></PmtId>
          <Amt><InstdAmt Ccy="${o.currency || "EUR"}">${Number(o.amount).toFixed(2)}</InstdAmt></Amt>
          <CdtrAgt><FinInstnId><BIC>${recipientBIC}</BIC></FinInstnId></CdtrAgt>
          <Cdtr><Nm>${escXml(recipientName)}</Nm></Cdtr>
          <CdtrAcct><Id><IBAN>${recipientIBAN}</IBAN></Id></CdtrAcct>
          <RmtInf><Ustrd>${escXml(o.description || o.payment_purpose || "Payment")}</Ustrd></RmtInf>
        </CdtTrfTxInf>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creationDate}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty><Nm>${escXml(initiatorName)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-PMT</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${requestedDate}</ReqdExctnDt>
      <Dbtr><Nm>${escXml(initiatorName)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${initiatorIBAN}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${initiatorBIC}</BIC></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${txns}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function SepaExport() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: paymentOrders = [], isLoading } = useQuery({
    queryKey: ["payment_orders_sepa", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("payment_orders")
        .select("*, partners(name)")
        .eq("tenant_id", tenantId)
        .in("status", ["confirmed", "approved"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts_sepa", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("bank_accounts").select("*").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: legalEntity } = useQuery({
    queryKey: ["legal_entity_sepa", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase.from("legal_entities").select("name").eq("tenant_id", tenantId).limit(1).maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === paymentOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paymentOrders.map((o: any) => o.id)));
  };

  const selectedOrders = paymentOrders.filter((o: any) => selectedIds.has(o.id));
  const totalAmount = selectedOrders.reduce((s: number, o: any) => s + Number(o.amount), 0);

  const invalidOrders = selectedOrders.filter((o: any) => {
    const iban = (o.recipient_iban || o.recipient_account || "").replace(/\s/g, "");
    return !validateIBAN(iban);
  });

  const handleExport = () => {
    if (selectedOrders.length === 0) {
      toast({ title: t("error"), description: "Izaberite bar jedan nalog za plaćanje", variant: "destructive" });
      return;
    }

    const primaryAccount = bankAccounts[0];
    const initiatorIBAN = (primaryAccount?.iban || primaryAccount?.account_number || "").replace(/\s/g, "").toUpperCase();
    const initiatorBIC = primaryAccount?.swift_code || "NOTPROVIDED";
    const initiatorName = legalEntity?.name || "Company";

    const xml = generatePain001(selectedOrders, initiatorName, initiatorIBAN, initiatorBIC);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SEPA_pain001_${new Date().toISOString().split("T")[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: t("success"), description: `${selectedOrders.length} naloga eksportovano u SEPA XML` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="SEPA pain.001 Export" />

      <div className="flex items-center gap-4 flex-wrap">
        <Button onClick={handleExport} disabled={selectedOrders.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Eksportuj XML ({selectedOrders.length})
        </Button>
        {selectedOrders.length > 0 && (
          <Badge variant="secondary" className="text-sm">
            Ukupno: {totalAmount.toFixed(2)} {selectedOrders[0]?.currency || "RSD"}
          </Badge>
        )}
        {invalidOrders.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {invalidOrders.length} nevalidan IBAN
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selectedIds.size === paymentOrders.length && paymentOrders.length > 0} onCheckedChange={selectAll} />
                </TableHead>
                <TableHead>{t("number" as any) || "Broj"}</TableHead>
                <TableHead>{t("partner" as any) || "Partner"}</TableHead>
                <TableHead>{t("recipient" as any) || "Primalac"}</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead className="text-right">{t("amount" as any) || "Iznos"}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
              ) : paymentOrders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nema potvrđenih naloga za plaćanje</TableCell></TableRow>
              ) : paymentOrders.map((o: any) => {
                const iban = (o.recipient_iban || o.recipient_account || "").replace(/\s/g, "");
                const ibanValid = validateIBAN(iban);
                return (
                  <TableRow key={o.id}>
                    <TableCell><Checkbox checked={selectedIds.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} /></TableCell>
                    <TableCell className="font-mono text-sm">{o.payment_order_number || o.id.slice(0, 8)}</TableCell>
                    <TableCell>{o.partners?.name || o.recipient_name || "—"}</TableCell>
                    <TableCell>{o.recipient_name || "—"}</TableCell>
                    <TableCell>
                      <span className={ibanValid ? "" : "text-destructive"}>
                        {iban || "—"}
                      </span>
                      {!ibanValid && iban && <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />}
                    </TableCell>
                    <TableCell className="text-right font-medium">{Number(o.amount).toFixed(2)} {o.currency || "RSD"}</TableCell>
                    <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
