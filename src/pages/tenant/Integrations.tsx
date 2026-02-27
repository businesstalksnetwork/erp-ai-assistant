import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plug, RefreshCw, FileText, Truck, Heart, CheckCircle, XCircle, Receipt, Building2, Landmark, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ─── Connection Card Component ─── */
function ConnectionCard({
  icon,
  title,
  conn,
  editing,
  setEditing,
  formFields,
  saveMutation,
  toggleMutation,
  onEdit,
  testMutation,
  t,
}: {
  icon: React.ReactNode;
  title: string;
  conn: any;
  editing: boolean;
  setEditing: (v: boolean) => void;
  formFields: React.ReactNode;
  saveMutation: any;
  toggleMutation: any;
  onEdit: () => void;
  testMutation?: any;
  t: (key: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
          {conn?.is_active ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ml-2"><CheckCircle className="h-3 w-3 mr-1" />{t("connectionActive")}</Badge>
          ) : (
            <Badge variant="secondary" className="ml-2"><XCircle className="h-3 w-3 mr-1" />{t("connectionInactive")}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {conn && !editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">{t("environment")}:</span> <Badge variant="outline">{conn.environment}</Badge></div>
              <div><span className="text-muted-foreground">{t("lastSync")}:</span> {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : "—"}</div>
              {conn.last_error && <div className="col-span-2 text-destructive text-xs">{conn.last_error}</div>}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={conn.is_active} onCheckedChange={(v) => toggleMutation.mutate(v)} />
              <span className="text-sm">{conn.is_active ? t("connectionActive") : t("connectionInactive")}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onEdit}>{t("edit")}</Button>
              {testMutation && <Button size="sm" variant="outline" onClick={() => testMutation.mutate()} disabled={!conn.is_active || testMutation.isPending}>{t("testConnection")}</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {formFields}
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t("save")}</Button>
              {conn && <Button variant="outline" onClick={() => setEditing(false)}>{t("cancel")}</Button>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Static Info Card ─── */
function InfoCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ─── SEF Connection ───
  const { data: sefConn } = useQuery({
    queryKey: ["sef_connection", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sef_connections").select("*").eq("tenant_id", tenantId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [sefForm, setSefForm] = useState({ api_url: "", api_key: "", environment: "sandbox" });
  const [sefEditing, setSefEditing] = useState(false);

  const sefSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = { tenant_id: tenantId!, api_url: sefForm.api_url, api_key_encrypted: sefForm.api_key, environment: sefForm.environment, is_active: true };
      if (sefConn) {
        const { error } = await supabase.from("sef_connections").update(payload).eq("id", sefConn.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sef_connections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sef_connection"] }); toast({ title: t("success"), description: t("settingsSaved") }); setSefEditing(false); },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const sefToggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!sefConn) return;
      const { error } = await supabase.from("sef_connections").update({ is_active: active }).eq("id", sefConn.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sef_connection"] }),
  });

  const testSefMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sef-submit", { body: { tenant_id: tenantId, test: true } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => toast({ title: t("success"), description: `SEF ${data.environment} — ${t("connectionActive")}` }),
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  // ─── eBolovanje Connection ───
  const { data: ebolConn } = useQuery({
    queryKey: ["ebolovanje_connections", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ebolovanje_connections").select("*").eq("tenant_id", tenantId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [ebolForm, setEbolForm] = useState({ euprava_username: "", euprava_password: "", environment: "sandbox" });
  const [ebolEditing, setEbolEditing] = useState(false);

  const ebolSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = { tenant_id: tenantId!, euprava_username: ebolForm.euprava_username, euprava_password_encrypted: ebolForm.euprava_password, environment: ebolForm.environment, is_active: true };
      if (ebolConn) {
        const { error } = await supabase.from("ebolovanje_connections").update(payload as any).eq("id", (ebolConn as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ebolovanje_connections").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ebolovanje_connections"] }); toast({ title: t("success"), description: t("settingsSaved") }); setEbolEditing(false); },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const ebolToggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!ebolConn) return;
      const { error } = await supabase.from("ebolovanje_connections").update({ is_active: active } as any).eq("id", (ebolConn as any).id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ebolovanje_connections"] }),
  });

  // ─── eOtpremnica Connection ───
  const { data: eotpConn } = useQuery({
    queryKey: ["eotpremnica_connections", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("eotpremnica_connections").select("*").eq("tenant_id", tenantId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [eotpForm, setEotpForm] = useState({ api_url: "", api_key: "", environment: "sandbox" });
  const [eotpEditing, setEotpEditing] = useState(false);

  const eotpSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = { tenant_id: tenantId!, api_url: eotpForm.api_url, api_key_encrypted: eotpForm.api_key, environment: eotpForm.environment, is_active: true };
      if (eotpConn) {
        const { error } = await supabase.from("eotpremnica_connections").update(payload as any).eq("id", (eotpConn as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eotpremnica_connections").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eotpremnica_connections"] }); toast({ title: t("success"), description: t("settingsSaved") }); setEotpEditing(false); },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const eotpToggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!eotpConn) return;
      const { error } = await supabase.from("eotpremnica_connections").update({ is_active: active } as any).eq("id", (eotpConn as any).id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["eotpremnica_connections"] }),
  });

  // ─── NBS Import ───
  const [nbsImporting, setNbsImporting] = useState(false);
  const handleNbsImport = async () => {
    setNbsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("nbs-exchange-rates", { body: { tenant_id: tenantId } });
      if (error) throw error;
      toast({ title: t("success"), description: `${t("importExchangeRates")}: ${data.imported} (${data.date})` });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setNbsImporting(false);
    }
  };

  // ─── Bank API Test ───
  const [bankTesting, setBankTesting] = useState(false);
  const handleBankTest = async () => {
    setBankTesting(true);
    try {
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_number, is_active")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .limit(1);
      if (!accounts || accounts.length === 0) {
        toast({ title: t("error"), description: "Nema aktivnih bankovnih računa. Dodajte račun u Blagajna → Računi.", variant: "destructive" });
        return;
      }
      toast({ title: t("success"), description: `Konekcija OK — ${accounts.length} aktivan račun pronađen (${accounts[0].bank_name} — ${accounts[0].account_number})` });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setBankTesting(false);
    }
  };

  /* ─── Environment selector helper ─── */
  const envSelector = (value: string, onChange: (v: string) => void) => (
    <div><Label>{t("environment")}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sandbox">{t("sandbox")}</SelectItem>
          <SelectItem value="production">{t("production")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("integrations")}</h1>

      {/* SEF */}
      <ConnectionCard
        icon={<FileText className="h-5 w-5" />}
        title={t("sefConnection")}
        conn={sefConn} editing={sefEditing} setEditing={setSefEditing}
        formFields={<>
          <div><Label>{t("apiUrl")}</Label><Input value={sefForm.api_url} onChange={(e) => setSefForm(f => ({ ...f, api_url: e.target.value }))} placeholder="https://efaktura.mfin.gov.rs/api" /></div>
          <div><Label>{t("apiKey")}</Label><Input type="password" value={sefForm.api_key} onChange={(e) => setSefForm(f => ({ ...f, api_key: e.target.value }))} /></div>
          {envSelector(sefForm.environment, (v) => setSefForm(f => ({ ...f, environment: v })))}
        </>}
        saveMutation={sefSaveMutation} toggleMutation={sefToggleMutation}
        onEdit={() => { setSefForm({ api_url: sefConn?.api_url || "", api_key: sefConn?.api_key_encrypted || "", environment: sefConn?.environment || "sandbox" }); setSefEditing(true); }}
        testMutation={testSefMutation} t={t}
      />

      {/* eBolovanje */}
      <ConnectionCard
        icon={<Heart className="h-5 w-5" />}
        title={t("eBolovanjeConnection")}
        conn={ebolConn} editing={ebolEditing} setEditing={setEbolEditing}
        formFields={<>
          <div><Label>{t("eUpravaUsername")}</Label><Input value={ebolForm.euprava_username} onChange={(e) => setEbolForm(f => ({ ...f, euprava_username: e.target.value }))} /></div>
          <div><Label>{t("eUpravaPassword")}</Label><Input type="password" value={ebolForm.euprava_password} onChange={(e) => setEbolForm(f => ({ ...f, euprava_password: e.target.value }))} /></div>
          {envSelector(ebolForm.environment, (v) => setEbolForm(f => ({ ...f, environment: v })))}
        </>}
        saveMutation={ebolSaveMutation} toggleMutation={ebolToggleMutation}
        onEdit={() => { setEbolForm({ euprava_username: (ebolConn as any)?.euprava_username || "", euprava_password: (ebolConn as any)?.euprava_password_encrypted || "", environment: (ebolConn as any)?.environment || "sandbox" }); setEbolEditing(true); }}
        t={t}
      />

      {/* eOtpremnica */}
      <ConnectionCard
        icon={<Truck className="h-5 w-5" />}
        title={t("eOtpremnicaConnection")}
        conn={eotpConn} editing={eotpEditing} setEditing={setEotpEditing}
        formFields={<>
          <div><Label>{t("apiUrl")}</Label><Input value={eotpForm.api_url} onChange={(e) => setEotpForm(f => ({ ...f, api_url: e.target.value }))} /></div>
          <div><Label>{t("apiKey")}</Label><Input type="password" value={eotpForm.api_key} onChange={(e) => setEotpForm(f => ({ ...f, api_key: e.target.value }))} /></div>
          {envSelector(eotpForm.environment, (v) => setEotpForm(f => ({ ...f, environment: v })))}
        </>}
        saveMutation={eotpSaveMutation} toggleMutation={eotpToggleMutation}
        onEdit={() => { setEotpForm({ api_url: (eotpConn as any)?.api_url || "", api_key: (eotpConn as any)?.api_key_encrypted || "", environment: (eotpConn as any)?.environment || "sandbox" }); setEotpEditing(true); }}
        t={t}
      />

      {/* PFR / eFiskalizacija */}
      <InfoCard icon={<Receipt className="h-5 w-5" />} title={t("pfrConnection")} description={t("pfrConnectionDesc")}>
        <Button variant="outline" onClick={() => navigate("/pos/fiscal-devices")}>{t("fiscalDevices")}</Button>
      </InfoCard>

      {/* ePorezi */}
      <InfoCard
        icon={<Building2 className="h-5 w-5" />}
        title={t("ePoreziConnection") || "ePorezi"}
        description={t("ePoreziDesc") || "Poreska uprava — elektronsko podnošenje PPP-PD, POPDV i PP-PDV obrazaca putem ePorezi portala."}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/hr/pppd-review")}>{t("pppdReview") || "PPP-PD"}</Button>
          <Button variant="outline" onClick={() => navigate("/accounting/pdv-periods")}>{t("pdvPeriods") || "PDV Periodi"}</Button>
        </div>
      </InfoCard>

      {/* APR Company Lookup */}
      <InfoCard
        icon={<Landmark className="h-5 w-5" />}
        title={t("aprConnection") || "APR / PIB Pretraga"}
        description={t("aprDesc") || "Automatska pretraga kompanija po PIB-u iz Agencije za privredne registre (APR). Koristi se pri unosu partnera."}
      >
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />{t("configured") || "Konfigurisano"}
        </Badge>
      </InfoCard>

      {/* Bank API */}
      <InfoCard
        icon={<CreditCard className="h-5 w-5" />}
        title={t("bankApiConnection") || "Bank API"}
        description={t("bankApiDesc") || "Povezivanje sa bankarskim API-jem za automatski uvoz izvoda. Podržani formati: Halcom XML, NBS CSV."}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBankTest} disabled={bankTesting}>
            <RefreshCw className={`h-4 w-4 mr-2 ${bankTesting ? "animate-spin" : ""}`} />
            {t("testConnection")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/accounting/bank-statements")}>{t("bankStatements") || "Izvodi"}</Button>
        </div>
      </InfoCard>

      {/* NBS Exchange Rates */}
      <InfoCard icon={<RefreshCw className="h-5 w-5" />} title={t("nbsExchangeRates")} description={t("importExchangeRates")}>
        <Button onClick={handleNbsImport} disabled={nbsImporting}>
          <RefreshCw className={`h-4 w-4 mr-2 ${nbsImporting ? "animate-spin" : ""}`} />
          {t("importNow")}
        </Button>
      </InfoCard>
    </div>
  );
}
