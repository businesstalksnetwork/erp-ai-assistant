import { Link } from "react-router-dom";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, FileText, Receipt, Library, Landmark, ListChecks,
  Calculator, CalendarCheck, Building, Clock, Wallet, DollarSign,
  RefreshCw, ArrowLeftRight, Lock, BarChart3, Repeat, RotateCw,
  FileCheck, PieChart, Banknote, Building2, Scale, FileSpreadsheet, Layers,
  BookText, Columns, Archive, FileBarChart,
} from "lucide-react";

const sections = [
  {
    title: "Osnovno",
    links: [
      { to: "/accounting/chart-of-accounts", icon: BookOpen, label: "Kontni plan", desc: "Pregled i upravljanje kontnim okvirom" },
      { to: "/accounting/journal", icon: FileText, label: "Knjiženja", desc: "Dnevnik knjiženja i temeljnice" },
      { to: "/accounting/invoices", icon: Receipt, label: "Fakture", desc: "Izlazne fakture i upravljanje naplatom" },
      { to: "/accounting/ledger", icon: Library, label: "Glavna knjiga", desc: "Sintetički i analitički pregled konta" },
    ],
  },
  {
    title: "Banka i potraživanja",
    links: [
      { to: "/accounting/bank-statements", icon: Landmark, label: "Izvodi", desc: "Uvoz i usklađivanje bankovnih izvoda" },
      { to: "/accounting/open-items", icon: ListChecks, label: "Otvorene stavke", desc: "Nenaplaćena potraživanja i obaveze" },
      { to: "/accounting/ios", icon: FileCheck, label: "IOS", desc: "Izvod otvorenih stavki — potvrda salda sa partnerima" },
      { to: "/accounting/cash-register", icon: Banknote, label: "Blagajna", desc: "Blagajnički dnevnik — gotovinske uplate i isplate" },
    ],
  },
  {
    title: "Porezi i periodi",
    links: [
      { to: "/accounting/pdv", icon: Calculator, label: "PDV periodi", desc: "Obračun i prijava poreza na dodatu vrednost" },
      { to: "/accounting/fiscal-periods", icon: CalendarCheck, label: "Fiskalni periodi", desc: "Upravljanje fiskalnim periodima" },
      { to: "/accounting/withholding-tax", icon: Scale, label: "Porez po odbitku", desc: "Obračun poreza na isplate nerezidentima" },
      { to: "/accounting/cit-return", icon: FileSpreadsheet, label: "PDP prijava", desc: "Godišnji porez na dobit (15%)" },
    ],
  },
  {
    title: "Imovina i obaveze",
    links: [
      { to: "/accounting/fixed-assets", icon: Building, label: "Osnovna sredstva", desc: "Evidencija i amortizacija osnovnih sredstava" },
      { to: "/accounting/deferrals", icon: Clock, label: "Razgraničenja", desc: "Vremenska razgraničenja prihoda i rashoda" },
      { to: "/accounting/loans", icon: Wallet, label: "Krediti", desc: "Evidencija kredita i otplatnih planova" },
      { to: "/accounting/expenses", icon: DollarSign, label: "Troškovi", desc: "Pregled i klasifikacija troškova" },
    ],
  },
  {
    title: "Automatizacija",
    links: [
      { to: "/accounting/recurring-invoices", icon: Repeat, label: "Ponavljajuće fakture", desc: "Automatsko generisanje periodičnih faktura" },
      { to: "/accounting/recurring-journals", icon: RotateCw, label: "Ponavljajuća knjiženja", desc: "Automatske periodične temeljnice" },
    ],
  },
  {
    title: "Posebne operacije",
    links: [
      { to: "/accounting/fx-revaluation", icon: RefreshCw, label: "Revalorizacija", desc: "Kursne razlike i revalorizacija deviznih stavki" },
      { to: "/accounting/kompenzacija", icon: ArrowLeftRight, label: "Kompenzacija", desc: "Međusobno prebijanje potraživanja i obaveza" },
      { to: "/accounting/intercompany", icon: Building2, label: "Intercompany", desc: "Međukompanijske transakcije između pravnih lica" },
      { to: "/accounting/transfer-pricing", icon: Scale, label: "Transferne cene", desc: "Transakcije sa povezanim licima i dokumentacija" },
      { to: "/accounting/year-end", icon: Lock, label: "Zaključak godine", desc: "Godišnji obračun i zatvaranje knjiga" },
      { to: "/accounting/reports", icon: BarChart3, label: "Izveštaji", desc: "Bilans stanja, bilans uspeha i bruto bilans" },
      { to: "/accounting/reports/cost-center-pl", icon: PieChart, label: "P&L po MT", desc: "Profitabilnost po mestima troškova" },
      { to: "/accounting/reports/consolidated", icon: Layers, label: "Konsolidacija", desc: "Konsolidovani finansijski izveštaji grupe" },
      { to: "/accounting/reports/multi-period", icon: Columns, label: "Uporedni izveštaji", desc: "Poređenje fin. izveštaja za dva perioda" },
      { to: "/accounting/statisticki-aneks", icon: FileBarChart, label: "Statistički aneks", desc: "Dodatni podaci uz godišnje izveštaje za APR" },
      { to: "/accounting/kpo-book", icon: BookText, label: "KPO Knjiga", desc: "Knjiga prihoda i rashoda za paušalce" },
      { to: "/accounting/report-snapshots", icon: Archive, label: "Arhiva izveštaja", desc: "Zamrznute verzije izveštaja za reviziju" },
    ],
  },
];

export default function AccountingHub() {
  return (
    <BiPageLayout
      title="Računovodstvo"
      description="Kompletno upravljanje finansijskim poslovanjem — od knjiženja i fakturisanja do poreskih prijava i godišnjeg obračuna."
      icon={BookOpen}
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
