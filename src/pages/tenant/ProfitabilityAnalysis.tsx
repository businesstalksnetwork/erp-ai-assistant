import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
// @ts-ignore deep instantiation
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, Package, Building } from "lucide-react";

export default function ProfitabilityAnalysis() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const [tab, setTab] = useState("customer");

  // By customer (from invoices)
  const { data: customerData, isLoading: loadingCust } = useQuery({
    queryKey: ["profitability-customer", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("partner_name, total, status")
        .eq("tenant_id", tenantId!)
        .in("status", ["paid", "sent", "posted"]);

      if (!invoices) return [];
      const byCustomer: Record<string, number> = {};
      for (const inv of invoices) {
        const name = inv.partner_name || (sr ? "Nepoznato" : "Unknown");
        byCustomer[name] = (byCustomer[name] || 0) + Number(inv.total);
      }
      return Object.entries(byCustomer)
        .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);
    },
  });

  // By product (from invoice lines)
  const { data: productData, isLoading: loadingProd } = useQuery({
    queryKey: ["profitability-product", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await supabase
        .from("invoice_lines")
        .select("description, quantity, unit_price, total, invoice:invoice_id(tenant_id, status)")
        .eq("invoice.tenant_id", tenantId!);

      if (!lines) return [];
      const byProduct: Record<string, { revenue: number; qty: number }> = {};
      for (const line of lines as any[]) {
        if (!["paid", "sent", "posted"].includes(line.invoice?.status)) continue;
        const name = line.description || (sr ? "Proizvod" : "Product");
        if (!byProduct[name]) byProduct[name] = { revenue: 0, qty: 0 };
        byProduct[name].revenue += Number(line.total) || 0;
        byProduct[name].qty += Number(line.quantity) || 0;
      }
      return Object.entries(byProduct)
        .map(([name, d]) => ({ name, revenue: Math.round(d.revenue), qty: d.qty }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);
    },
  });

  // By cost center
  const { data: ccData, isLoading: loadingCC } = useQuery({
    queryKey: ["profitability-cc", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("amount, side, cost_center:cost_center_id(name), accounts:account_id(account_type), journal:journal_entry_id(status)") as any)
        .eq("tenant_id", tenantId!)
        .not("cost_center_id", "is", null);

      if (!lines) return [];
      const byCC: Record<string, { revenue: number; expenses: number }> = {};
      for (const line of lines as any[]) {
        if (line.journal?.status !== "posted") continue;
        const ccName = line.cost_center?.name || "—";
        if (!byCC[ccName]) byCC[ccName] = { revenue: 0, expenses: 0 };
        const amt = Number(line.amount) || 0;
        if (line.accounts?.account_type === "revenue") byCC[ccName].revenue += line.side === "credit" ? amt : -amt;
        else if (line.accounts?.account_type === "expense") byCC[ccName].expenses += line.side === "debit" ? amt : -amt;
      }
      return Object.entries(byCC)
        .map(([name, d]) => ({ name, revenue: Math.round(d.revenue), expenses: Math.round(d.expenses), profit: Math.round(d.revenue - d.expenses) }))
        .sort((a, b) => b.profit - a.profit);
    },
  });

  const isLoading = tab === "customer" ? loadingCust : tab === "product" ? loadingProd : loadingCC;

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Analiza profitabilnosti" : "Profitability Analysis"} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="customer" className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{sr ? "Po kupcu" : "By Customer"}</TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />{sr ? "Po proizvodu" : "By Product"}</TabsTrigger>
          <TabsTrigger value="costcenter" className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5" />{sr ? "Po troškovnom centru" : "By Cost Center"}</TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="space-y-4 mt-4">
          {loadingCust ? <Skeleton className="h-80" /> : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={customerData?.slice(0, 10) || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="revenue" name={sr ? "Prihod" : "Revenue"} fill="hsl(220, 70%, 50%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{sr ? "Kupac" : "Customer"}</TableHead>
                        <TableHead className="text-right">{sr ? "Prihod" : "Revenue"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(customerData || []).map(c => (
                        <TableRow key={c.name}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right font-medium">{c.revenue.toLocaleString()} RSD</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="product" className="space-y-4 mt-4">
          {loadingProd ? <Skeleton className="h-80" /> : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{sr ? "Proizvod" : "Product"}</TableHead>
                      <TableHead className="text-right">{sr ? "Količina" : "Quantity"}</TableHead>
                      <TableHead className="text-right">{sr ? "Prihod" : "Revenue"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(productData || []).map(p => (
                      <TableRow key={p.name}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right font-medium">{p.revenue.toLocaleString()} RSD</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="costcenter" className="space-y-4 mt-4">
          {loadingCC ? <Skeleton className="h-80" /> : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={ccData || []}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" name={sr ? "Prihod" : "Revenue"} fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name={sr ? "Rashodi" : "Expenses"} fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{sr ? "Troškovni centar" : "Cost Center"}</TableHead>
                        <TableHead className="text-right">{sr ? "Prihod" : "Revenue"}</TableHead>
                        <TableHead className="text-right">{sr ? "Rashodi" : "Expenses"}</TableHead>
                        <TableHead className="text-right">{sr ? "Profit" : "Profit"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ccData || []).map(c => (
                        <TableRow key={c.name}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right">{c.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{c.expenses.toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-medium ${c.profit >= 0 ? "text-accent" : "text-destructive"}`}>{c.profit.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
