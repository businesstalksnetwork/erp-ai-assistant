import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, FileText, ClipboardList, Store, UserCheck, BarChart3, Globe, Receipt } from "lucide-react";

const sections = [
  {
    title: "Dokumenti",
    links: [
      { to: "/sales/quotes", icon: FileText, label: "Ponude", desc: "Kreiranje i slanje ponuda kupcima" },
      { to: "/sales/sales-orders", icon: ClipboardList, label: "Prodajni nalozi", desc: "Upravljanje prodajnim nalozima" },
    ],
  },
  {
    title: "Tim & Učinak",
    links: [
      { to: "/sales/sales-channels", icon: Store, label: "Kanali prodaje", desc: "Konfiguracija prodajnih kanala" },
      { to: "/sales/salespeople", icon: UserCheck, label: "Prodavci", desc: "Evidencija prodajnog osoblja" },
      { to: "/sales/sales-performance", icon: BarChart3, label: "Učinak prodaje", desc: "Analitika prodajnih rezultata" },
    ],
  },
  {
    title: "Web prodaja",
    links: [
      { to: "/sales/web-settings", icon: Globe, label: "Web podešavanja", desc: "Konfiguracija web prodavnice i integracija" },
      { to: "/sales/web-prices", icon: Receipt, label: "Web cene", desc: "Upravljanje cenama za web prodaju" },
    ],
  },
];

export default function SalesHub() {
  return (
    <BiPageLayout
      title="Prodaja"
      description="Upravljanje prodajnim aktivnostima — ponude, nalozi, kanali prodaje, web prodaja i analitika učinka."
      icon={TrendingUp}
    >
      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
