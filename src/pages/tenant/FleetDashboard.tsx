import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Car, Fuel, Wrench, Shield, FileText, Plus, AlertTriangle, CheckCircle,
  Calendar, Gauge,
} from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatItem } from "@/components/shared/StatsBar";

const sections = [
  {
    title: "Vozni park",
    links: [
      { to: "/assets/fleet/vehicles", icon: Car, label: "Vozila", desc: "Registar svih vozila" },
      { to: "/assets/fleet/vehicles/new", icon: Plus, label: "Novo vozilo", desc: "Dodaj vozilo u vozni park" },
    ],
  },
  {
    title: "Troškovi i održavanje",
    links: [
      { to: "/assets/fleet/fuel", icon: Fuel, label: "Gorivo", desc: "Evidencija utroška goriva" },
      { to: "/assets/fleet/service", icon: Wrench, label: "Servisni nalozi", desc: "Redovni i vanredni servisi" },
    ],
  },
  {
    title: "Dokumentacija",
    links: [
      { to: "/assets/fleet/registrations", icon: FileText, label: "Registracije", desc: "Registracija i tehnički pregled" },
      { to: "/assets/fleet/insurance", icon: Shield, label: "Osiguranja", desc: "Polise obaveznog i kasko osiguranja" },
    ],
  },
];

export default function FleetDashboard() {
  const { tenantId } = useTenant();

  const { data: kpi } = useQuery({
    queryKey: ["fleet-dashboard-kpi", tenantId],
    queryFn: async () => {
      if (!tenantId) return { totalVehicles: 0, expiringSoon: 0, serviceDue: 0, fuelThisMonth: 0 };

      const [vehicles, registrations, services] = await Promise.all([
        supabase.from("fleet_vehicles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("fleet_registrations").select("id, expiry_date").eq("tenant_id", tenantId),
        supabase.from("fleet_service_orders").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "planned"),
      ]);

      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86400000);
      const expiring = (registrations.data || []).filter(r => {
        const d = new Date(r.expiry_date);
        return d >= now && d <= in30;
      }).length;

      return {
        totalVehicles: vehicles.count || 0,
        expiringSoon: expiring,
        serviceDue: services.count || 0,
        fuelThisMonth: 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const stats: StatItem[] = kpi
    ? [
        { label: "Ukupno vozila", value: kpi.totalVehicles, icon: Car, color: "text-primary" },
        { label: "Ističe registracija", value: kpi.expiringSoon, icon: AlertTriangle, color: "text-destructive" },
        { label: "Planiran servis", value: kpi.serviceDue, icon: Wrench, color: "text-accent" },
        { label: "Aktivna vozila", value: kpi.totalVehicles, icon: CheckCircle, color: "text-primary" },
      ]
    : [];

  return (
    <BiPageLayout
      title="Vozni park"
      description="Upravljanje vozilima, registracijama, osiguranjima, gorivom i servisima."
      icon={Car}
      stats={stats}
    >
      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {section.links.map((link) => (
              <Link key={link.to} to={link.to}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="flex flex-col items-center justify-center p-6 gap-3 text-center">
                    <link.icon className="h-8 w-8 text-primary" />
                    <span className="text-sm font-medium">{link.label}</span>
                    <span className="text-xs text-muted-foreground">{link.desc}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </BiPageLayout>
  );
}
