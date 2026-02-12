import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Currencies() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: currencies = [], isLoading: currLoading } = useQuery({
    queryKey: ["currencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("currencies").select("*").eq("tenant_id", tenantId).order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: rates = [], isLoading: ratesLoading } = useQuery({
    queryKey: ["exchange_rates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("exchange_rates").select("*").eq("tenant_id", tenantId).order("rate_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("currencies")}</h1>
        <Button size="sm" disabled><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
      </div>
      <Tabs defaultValue="currencies">
        <TabsList>
          <TabsTrigger value="currencies">{t("currencies")}</TabsTrigger>
          <TabsTrigger value="rates">{t("exchangeRates")}</TabsTrigger>
        </TabsList>
        <TabsContent value="currencies">
          <Card>
            <CardHeader><CardTitle>{t("currencies")}</CardTitle></CardHeader>
            <CardContent>
              {currLoading ? <p className="text-muted-foreground">{t("loading")}</p> : currencies.length === 0 ? <p className="text-muted-foreground">{t("noResults")}</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("code")}</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("symbol")}</TableHead>
                      <TableHead>{t("baseCurrency")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.symbol || "—"}</TableCell>
                        <TableCell>{c.is_base ? <Badge>{t("baseCurrency")}</Badge> : "—"}</TableCell>
                        <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rates">
          <Card>
            <CardHeader><CardTitle>{t("exchangeRates")}</CardTitle></CardHeader>
            <CardContent>
              {ratesLoading ? <p className="text-muted-foreground">{t("loading")}</p> : rates.length === 0 ? <p className="text-muted-foreground">{t("noResults")}</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("fromCurrency")}</TableHead>
                      <TableHead>{t("toCurrency")}</TableHead>
                      <TableHead>{t("rate")}</TableHead>
                      <TableHead>{t("source")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.rate_date}</TableCell>
                        <TableCell>{r.from_currency}</TableCell>
                        <TableCell>{r.to_currency}</TableCell>
                        <TableCell>{Number(r.rate).toFixed(4)}</TableCell>
                        <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
