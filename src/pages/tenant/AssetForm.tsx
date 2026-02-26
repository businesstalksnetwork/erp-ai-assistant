import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Save } from "lucide-react";

const schema = z.object({
  name: z.string().min(1),
  asset_type: z.enum(["fixed_asset", "vehicle", "material_good", "intangible"]),
  category_id: z.string().optional(),
  status: z.enum(["draft", "active", "in_use", "maintenance", "disposed", "written_off"]),
  serial_number: z.string().optional(),
  inventory_number: z.string().optional(),
  acquisition_date: z.string().optional(),
  acquisition_cost: z.coerce.number().min(0).default(0),
  current_value: z.coerce.number().min(0).default(0),
  residual_value: z.coerce.number().min(0).default(0),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AssetForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      asset_type: "fixed_asset",
      status: "draft",
      acquisition_cost: 0,
      current_value: 0,
      residual_value: 0,
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["asset-categories", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("asset_categories")
        .select("id, name, code, asset_type, code_prefix")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: existing } = useQuery({
    queryKey: ["asset-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        name: existing.name,
        asset_type: existing.asset_type as any,
        category_id: existing.category_id || undefined,
        status: existing.status as any,
        serial_number: existing.serial_number || "",
        inventory_number: existing.inventory_number || "",
        acquisition_date: existing.acquisition_date || "",
        acquisition_cost: Number(existing.acquisition_cost) || 0,
        current_value: Number(existing.current_value) || 0,
        residual_value: Number(existing.residual_value) || 0,
        description: existing.description || "",
        notes: existing.notes || "",
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenantId) throw new Error("No tenant");

      let asset_code = existing?.asset_code;
      if (!isEdit) {
        const cat = categories.find((c: any) => c.id === values.category_id);
        const prefix = cat?.code_prefix || cat?.code || "AST";
        const { data: codeData } = await supabase.rpc("generate_asset_code", {
          p_tenant_id: tenantId,
          p_prefix: prefix,
        });
        asset_code = codeData || `AST-${Date.now()}`;
      }

      const payload: any = {
        ...values,
        tenant_id: tenantId,
        asset_code: asset_code!,
        category_id: values.category_id || null,
        acquisition_date: values.acquisition_date || null,
        serial_number: values.serial_number || null,
        inventory_number: values.inventory_number || null,
        description: values.description || null,
        notes: values.notes || null,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("assets")
          .update(payload)
          .eq("id", id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assets").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved" as any));
      qc.invalidateQueries({ queryKey: ["assets-registry"] });
      qc.invalidateQueries({ queryKey: ["assets-stats"] });
      navigate("/assets/registry");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-1 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEdit ? t("edit" as any) : t("assetsNewAsset" as any)}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("assetsBasicInfo" as any)}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t("name" as any)}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="asset_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("type" as any)}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="fixed_asset">{t("assetsFixedAsset" as any)}</SelectItem>
                      <SelectItem value="intangible">{t("assetsIntangible" as any)}</SelectItem>
                      <SelectItem value="material_good">{t("assetsMaterialGood" as any)}</SelectItem>
                      <SelectItem value="vehicle">{t("assetsVehicle" as any)}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("assetsCategory" as any)}</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("status")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["draft","active","in_use","maintenance","disposed","written_off"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="serial_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("assetsSerialNumber" as any)}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="inventory_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("assetsInventoryNumber" as any)}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="acquisition_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("assetsAcquisitionDate" as any)}</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("assetsFinancialInfo" as any)}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="acquisition_cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("assetsAcquisitionCost" as any)}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="current_value" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("assetsCurrentValue" as any)}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="residual_value" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("assetsResidualValue" as any)}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>{t("cancel")}</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> {t("save")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
