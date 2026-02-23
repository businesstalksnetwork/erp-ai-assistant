import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Layers, ClipboardList, BrainCircuit } from "lucide-react";

const links = [
  { to: "/production/bom", icon: Layers, label: "Sastavnice (BOM)", desc: "Definicije materijala i komponenti za proizvode" },
  { to: "/production/orders", icon: ClipboardList, label: "Radni nalozi", desc: "Kreiranje, praćenje i zatvaranje proizvodnih naloga" },
  { to: "/production/ai-planning", icon: BrainCircuit, label: "AI planiranje", desc: "Inteligentno planiranje kapaciteta i rasporeda proizvodnje" },
];

export default function ProductionHub() {
  return (
    <BiPageLayout
      title="Proizvodnja"
      description="Upravljanje proizvodnim procesima — od sastavnica i radnih naloga do AI optimizacije plana proizvodnje."
      icon={Factory}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
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
    </BiPageLayout>
  );
}
