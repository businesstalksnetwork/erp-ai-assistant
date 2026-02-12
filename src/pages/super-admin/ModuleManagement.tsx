import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ModuleManagement() {
  const { t } = useLanguage();
  const [modules, setModules] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("module_definitions").select("*").order("sort_order").then(({ data }) => {
      if (data) setModules(data);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("moduleManagement")}</h1>
      <p className="text-muted-foreground">Manage which modules are available to each tenant. Select a tenant first, then toggle modules.</p>

      <Card>
        <CardHeader>
          <CardTitle>Available Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((mod) => (
                <TableRow key={mod.id}>
                  <TableCell className="font-medium">{mod.name}</TableCell>
                  <TableCell className="text-muted-foreground">{mod.description}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{mod.key}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
