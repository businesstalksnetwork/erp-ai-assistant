import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Monitor, MonitorSmartphone, ListChecks, Cpu, FileBarChart } from "lucide-react";

const links = [
  { to: "/pos/terminal", icon: MonitorSmartphone, label: "POS terminal", desc: "Prodajno mesto za direktnu naplatu" },
  { to: "/pos/sessions", icon: ListChecks, label: "Sesije", desc: "Pregled otvorenih i zatvorenih POS sesija" },
  { to: "/pos/fiscal-devices", icon: Cpu, label: "Fiskalni uređaji", desc: "Konfiguracija fiskalnih štampača i uređaja" },
  { to: "/pos/daily-report", icon: FileBarChart, label: "Dnevni izveštaj", desc: "Dnevni pregled prometa i transakcija" },
];

export default function PosHub() {
  return (
    <BiPageLayout
      title="Maloprodaja (POS)"
      description="Upravljanje maloprodajnim operacijama — POS terminal, fiskalna kasa, sesije i dnevni izveštaji."
      icon={Monitor}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
