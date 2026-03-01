import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Send, Loader2 } from "lucide-react";

interface Signer {
  email: string;
  name: string;
}

interface DocumentSignatureRequestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
}

export function DocumentSignatureRequest({ open, onOpenChange, documentId, documentTitle }: DocumentSignatureRequestProps) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [signers, setSigners] = useState<Signer[]>([{ email: "", name: "" }]);
  const [sending, setSending] = useState(false);

  const addSigner = () => setSigners(prev => [...prev, { email: "", name: "" }]);
  const removeSigner = (idx: number) => setSigners(prev => prev.filter((_, i) => i !== idx));
  const updateSigner = (idx: number, field: keyof Signer, value: string) => {
    setSigners(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSend = async () => {
    const validSigners = signers.filter(s => s.email.trim());
    if (validSigners.length === 0) {
      toast({ title: "Dodajte barem jednog potpisnika", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      // Create signature records
      const inserts = validSigners.map(s => ({
        tenant_id: tenantId!,
        document_id: documentId,
        signer_email: s.email.trim(),
        signer_name: s.name.trim() || null,
        requested_by: user?.id,
      }));

      const { data: created, error } = await supabase
        .from("document_signatures")
        .insert(inserts)
        .select("id, token, signer_email");

      if (error) throw error;

      // Send notification emails
      for (const sig of created || []) {
        try {
          await supabase.functions.invoke("send-document-signature", {
            body: {
              signature_id: sig.id,
              action: "request",
              app_url: window.location.origin,
            },
          });
        } catch { /* non-critical */ }
      }

      toast({ title: `Poslato ${validSigners.length} zahtev(a) za potpis` });
      onOpenChange(false);
      setSigners([{ email: "", name: "" }]);
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zahtev za potpis</DialogTitle>
          <p className="text-sm text-muted-foreground">{documentTitle}</p>
        </DialogHeader>

        <div className="space-y-3">
          {signers.map((signer, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={signer.email}
                  onChange={e => updateSigner(idx, "email", e.target.value)}
                  placeholder="email@primer.com"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Ime (opciono)</Label>
                <Input
                  value={signer.name}
                  onChange={e => updateSigner(idx, "name", e.target.value)}
                  placeholder="Ime Prezime"
                />
              </div>
              {signers.length > 1 && (
                <Button size="icon-sm" variant="ghost" className="text-destructive mb-0.5" onClick={() => removeSigner(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addSigner} className="w-full">
            <Plus className="h-3 w-3 mr-1" /> Dodaj potpisnika
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Pošalji zahteve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
