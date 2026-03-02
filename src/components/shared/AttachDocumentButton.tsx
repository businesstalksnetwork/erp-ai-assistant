import { useState, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AttachDocumentButtonProps {
  entityType: string;
  entityId: string;
  size?: "sm" | "default" | "icon";
}

export function AttachDocumentButton({ entityType, entityId, size = "sm" }: AttachDocumentButtonProps) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!tenantId) throw new Error("No tenant");

      const filePath = `${tenantId}/${entityType}/${entityId}/${Date.now()}_${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record linked to entity
      const { error: docError } = await supabase.from("documents").insert({
        tenant_id: tenantId,
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        entity_type: entityType,
        entity_id: entityId,
        uploaded_by: user?.id || null,
        status: "active",
      });

      if (docError) throw docError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-documents", entityType, entityId] });
      toast({ title: t("documentUploaded") || "Dokument priložen" });
    },
    onError: (e: any) => {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
      />
      <Button
        size={size}
        variant="outline"
        className="gap-1"
        disabled={uploadMutation.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
        {size !== "icon" && (t("attachDocument") || "Priloži dokument")}
      </Button>
    </>
  );
}
