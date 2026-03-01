import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScanText, Loader2 } from "lucide-react";

interface OcrButtonProps {
  documentId: string;
  tenantId: string;
  fileUrl: string;
  onComplete?: (text: string) => void;
}

export function OcrButton({ documentId, tenantId, fileUrl, onComplete }: OcrButtonProps) {
  const [loading, setLoading] = useState(false);

  const runOcr = async () => {
    setLoading(true);
    try {
      // Download the file and convert to base64
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });

      const { data, error } = await supabase.functions.invoke("document-ocr", {
        body: { tenant_id: tenantId, document_id: documentId, image_base64: base64 },
      });

      if (error) throw error;
      toast.success("OCR završen");
      onComplete?.(data?.text || "");
    } catch (e: any) {
      toast.error(e.message || "OCR greška");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={runOcr} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ScanText className="h-4 w-4 mr-2" />}
      OCR
    </Button>
  );
}
