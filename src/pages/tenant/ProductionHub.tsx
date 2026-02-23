import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Layers, ClipboardList, BrainCircuit, KanbanSquare, GanttChart, ShieldCheck, TrendingDown, Cog, Wrench } from "lucide-react";

const sections = [
  {
    title: "Operacije",
    links: [
      { to: "/production/bom", icon: Layers, label: "Sastavnice (BOM)", desc: "Definicije materijala i komponenti za proizvode" },
      { to: "/production/orders", icon: ClipboardList, label: "Radni nalozi", desc: "Kreiranje, praćenje i zatvaranje proizvodnih naloga" },
      { to: "/production/kanban", icon: KanbanSquare, label: "Kanban tabla", desc: "Vizuelni pregled statusa radnih naloga" },
      { to: "/production/gantt", icon: GanttChart, label: "Gantt dijagram", desc: "Vremenski plan proizvodnje" },
    ],
  },
  {
    title: "Planiranje i analiza",
    links: [
      { to: "/production/mrp", icon: Cog, label: "MRP Motor", desc: "Planiranje materijalnih potreba" },
      { to: "/production/quality", icon: ShieldCheck, label: "Kontrola kvaliteta", desc: "Inspekcije i praćenje defekata" },
      { to: "/production/cost-variance", icon: TrendingDown, label: "Analiza varijanse", desc: "Poređenje planiranih i stvarnih troškova" },
      { to: "/production/maintenance", icon: Wrench, label: "Održavanje opreme", desc: "Preventivno i korektivno održavanje" },
    ],
  },
  {
    title: "AI planiranje",
    links: [
      { to: "/production/ai-planning", icon: BrainCircuit, label: "AI planiranje", desc: "Inteligentno planiranje kapaciteta i rasporeda proizvodnje" },
    ],
  },
];

export default function ProductionHub() {
  return (
    <BiPageLayout
      title="Proizvodnja"
      description="Upravljanje proizvodnim procesima — od sastavnica i radnih naloga do AI optimizacije plana proizvodnje."
      icon={Factory}
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
