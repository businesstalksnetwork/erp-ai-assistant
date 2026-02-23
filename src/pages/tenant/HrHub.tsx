import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users, FileText, Building2, Clock, CalendarOff, Wallet,
  ClipboardList, Timer, Moon, Palmtree, Calendar, MinusCircle,
  PlusCircle, UserPlus, DollarSign, ShieldCheck, LayoutTemplate,
  HeartPulse, BarChart3,
} from "lucide-react";

const sections = [
  {
    title: "Zaposleni",
    links: [
      { to: "/hr/employees", icon: Users, label: "Zaposleni", desc: "Kartoni zaposlenih i lični podaci" },
      { to: "/hr/contracts", icon: FileText, label: "Ugovori", desc: "Ugovori o radu i aneksi" },
      { to: "/hr/departments", icon: Building2, label: "Odeljenja", desc: "Organizaciona struktura preduzeća" },
      { to: "/hr/external-workers", icon: UserPlus, label: "Spoljni saradnici", desc: "Evidencija spoljnih saradnika i konsultanata" },
      { to: "/hr/position-templates", icon: LayoutTemplate, label: "Šabloni pozicija", desc: "Predefinisane pozicije i opisi poslova" },
    ],
  },
  {
    title: "Radno vreme",
    links: [
      { to: "/hr/attendance", icon: Clock, label: "Evidencija prisustva", desc: "Dolasci, odlasci i prisutnost na radu" },
      { to: "/hr/work-logs", icon: ClipboardList, label: "Evidencija rada", desc: "Dnevni unos radnih sati po projektima" },
      { to: "/hr/overtime", icon: Timer, label: "Prekovremeni rad", desc: "Evidencija i obračun prekovremenog rada" },
      { to: "/hr/night-work", icon: Moon, label: "Noćni rad", desc: "Evidencija noćnih smena" },
    ],
  },
  {
    title: "Odsustva",
    links: [
      { to: "/hr/leave-requests", icon: CalendarOff, label: "Zahtevi za odsustvo", desc: "Podnošenje i odobravanje zahteva" },
      { to: "/hr/annual-leave", icon: Palmtree, label: "Godišnji odmor", desc: "Stanje i planiranje godišnjih odmora" },
      { to: "/hr/holidays", icon: Calendar, label: "Praznici", desc: "Državni i verski praznici" },
      { to: "/hr/ebolovanje", icon: HeartPulse, label: "eBolovanje", desc: "Elektronska prijava bolovanja" },
    ],
  },
  {
    title: "Zarade",
    links: [
      { to: "/hr/payroll", icon: Wallet, label: "Obračun zarada", desc: "Mesečni obračun plata i doprinosa" },
      { to: "/hr/salaries", icon: DollarSign, label: "Istorija plata", desc: "Pregled istorije zarada po zaposlenima" },
      { to: "/hr/deductions", icon: MinusCircle, label: "Odbici", desc: "Administrativne zabrane i odbici" },
      { to: "/hr/allowances", icon: PlusCircle, label: "Dodaci", desc: "Dodaci na zaradu (topli obrok, prevoz...)" },
      { to: "/hr/insurance", icon: ShieldCheck, label: "Osiguranje", desc: "Evidencija osiguranja zaposlenih" },
    ],
  },
  {
    title: "Izveštaji",
    links: [
      { to: "/hr/reports", icon: BarChart3, label: "HR izveštaji", desc: "Analitički izveštaji o ljudskim resursima" },
    ],
  },
];

export default function HrHub() {
  return (
    <BiPageLayout
      title="Ljudski resursi"
      description="Sveobuhvatno upravljanje zaposlenima — od evidencije radnog vremena i odsustva do obračuna zarada i kadrovskih izveštaja."
      icon={Users}
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
