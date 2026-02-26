import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, FileSignature, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ReversData = {
  id: string;
  revers_number: string;
  revers_type: string;
  revers_date: string;
  status: string;
  condition_on_handover: string | null;
  accessories: string | null;
  description: string | null;
  notes: string | null;
  signature_token: string | null;
  signature_token_expires_at: string | null;
  employee_signed_at: string | null;
  tenant_id: string;
  assets: { name: string; asset_code: string; inventory_number: string | null } | null;
  employees: { first_name: string; last_name: string } | null;
};

export default function ReversSignature() {
  const { token } = useParams<{ token: string }>();
  const [revers, setRevers] = useState<ReversData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid link"); setLoading(false); return; }
    loadRevers();
  }, [token]);

  const loadRevers = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("asset_reverses")
        .select("*, assets(name, asset_code, inventory_number), employees(first_name, last_name)")
        .eq("signature_token", token!)
        .single();

      if (fetchError || !data) {
        setError("Revers nije pronađen ili link nije validan.");
        return;
      }

      if (data.signature_token_expires_at && new Date(data.signature_token_expires_at) < new Date()) {
        setError("Link za potpis je istekao. Kontaktirajte vašu administraciju.");
        return;
      }

      if (data.status === "signed") {
        setError("Ovaj revers je već potpisan.");
        return;
      }

      if (data.status === "rejected") {
        setError("Ovaj revers je već odbijen.");
        return;
      }

      setRevers(data as ReversData);
      if (data.employees) {
        setSignerName(`${data.employees.first_name} ${data.employees.last_name}`);
      }
    } catch {
      setError("Greška pri učitavanju.");
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!revers || !signerName.trim()) {
      toast({ title: "Unesite ime i prezime", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("asset_reverses")
        .update({
          status: "signed",
          employee_signed_at: new Date().toISOString(),
          employee_signed_by_name: signerName.trim(),
        })
        .eq("id", revers.id)
        .eq("signature_token", token!);

      if (updateError) throw updateError;

      // Notify issuer
      try {
        await supabase.functions.invoke("send-revers-notification", {
          body: { revers_id: revers.id, tenant_id: revers.tenant_id, action: "signed" },
        });
      } catch { /* non-critical */ }

      setDone(true);
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!revers || !rejectionReason.trim()) {
      toast({ title: "Unesite razlog odbijanja", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("asset_reverses")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason.trim(),
        })
        .eq("id", revers.id)
        .eq("signature_token", token!);

      if (updateError) throw updateError;

      try {
        await supabase.functions.invoke("send-revers-notification", {
          body: { revers_id: revers.id, tenant_id: revers.tenant_id, action: "rejected" },
        });
      } catch { /* non-critical */ }

      setDone(true);
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <p className="text-lg font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-medium">Hvala! Vaš odgovor je zabeležen.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center p-4 pt-8 sm:pt-16">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <FileSignature className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle className="text-xl">Potpis reversa</CardTitle>
          <p className="text-sm text-muted-foreground">Revers br. {revers!.revers_number}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Details */}
          <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
            <Row label="Tip" value={revers!.revers_type === "handover" ? "Predaja" : "Povraćaj"} />
            <Row label="Sredstvo" value={`${revers!.assets?.asset_code} — ${revers!.assets?.name}`} />
            {revers!.assets?.inventory_number && <Row label="Inv. broj" value={revers!.assets.inventory_number} />}
            <Row label="Datum" value={revers!.revers_date} />
            {revers!.condition_on_handover && <Row label="Stanje" value={revers!.condition_on_handover} />}
            {revers!.accessories && <Row label="Pribor" value={revers!.accessories} />}
            {revers!.description && <Row label="Opis" value={revers!.description} />}
            {revers!.notes && <Row label="Napomene" value={revers!.notes} />}
          </div>

          {!showReject ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Ime i prezime potpisnika</Label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Ime Prezime" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSign} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Potpiši
                </Button>
                <Button variant="outline" onClick={() => setShowReject(true)} disabled={submitting} className="flex-1">
                  <XCircle className="h-4 w-4 mr-1" /> Odbij
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Razlog odbijanja</Label>
                <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} placeholder="Unesite razlog..." />
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleReject} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Potvrdi odbijanje
                </Button>
                <Button variant="outline" onClick={() => setShowReject(false)} disabled={submitting}>
                  Nazad
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
