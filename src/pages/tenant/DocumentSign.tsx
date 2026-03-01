import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, FileSignature, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SignatureData = {
  id: string;
  signer_email: string;
  signer_name: string | null;
  status: string;
  token_expires_at: string;
  document_id: string;
  tenant_id: string;
};

type DocInfo = {
  name: string;
  protocol_number: string | null;
  subject: string | null;
};

export default function DocumentSign() {
  const { token } = useParams<{ token: string }>();
  const [sig, setSig] = useState<SignatureData | null>(null);
  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError("Nevažeći link"); setLoading(false); return; }
    loadSignature();
  }, [token]);

  const loadSignature = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("token", token!)
        .single();

      if (fetchError || !data) { setError("Potpis nije pronađen ili link nije validan."); return; }
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
        setError("Link za potpis je istekao."); return;
      }
      if (data.status === "signed") { setError("Ovaj dokument je već potpisan."); return; }
      if (data.status === "rejected") { setError("Ovaj dokument je već odbijen."); return; }

      setSig(data as SignatureData);
      setSignerName(data.signer_name || "");

      // Fetch document info
      const { data: docData } = await supabase
        .from("documents")
        .select("name, protocol_number, subject")
        .eq("id", data.document_id)
        .single();
      if (docData) setDoc(docData as DocInfo);
    } catch {
      setError("Greška pri učitavanju.");
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!sig || !signerName.trim()) {
      toast({ title: "Unesite ime i prezime", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("document_signatures")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          signer_name: signerName.trim(),
        })
        .eq("id", sig.id)
        .eq("token", token!);
      if (updateError) throw updateError;

      // Notify via edge function (non-critical)
      try {
        await supabase.functions.invoke("send-document-signature", {
          body: { signature_id: sig.id, action: "signed" },
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
    if (!sig || !rejectionReason.trim()) {
      toast({ title: "Unesite razlog odbijanja", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("document_signatures")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq("id", sig.id)
        .eq("token", token!);
      if (updateError) throw updateError;

      try {
        await supabase.functions.invoke("send-document-signature", {
          body: { signature_id: sig.id, action: "rejected" },
        });
      } catch { /* non-critical */ }

      setDone(true);
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <p className="text-lg font-medium">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
          <p className="text-lg font-medium">Hvala! Vaš odgovor je zabeležen.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center p-4 pt-8 sm:pt-16">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <FileSignature className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle className="text-xl">Potpisivanje dokumenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {doc && (
            <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dokument</span>
                <span className="font-medium text-right">{doc.name}</span>
              </div>
              {doc.protocol_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Broj</span>
                  <span className="font-medium">{doc.protocol_number}</span>
                </div>
              )}
              {doc.subject && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Predmet</span>
                  <span className="font-medium text-right">{doc.subject}</span>
                </div>
              )}
            </div>
          )}

          {!showReject ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Ime i prezime potpisnika</Label>
                <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Ime Prezime" />
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
                <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} placeholder="Unesite razlog..." />
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleReject} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Potvrdi odbijanje
                </Button>
                <Button variant="outline" onClick={() => setShowReject(false)} disabled={submitting}>Nazad</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
