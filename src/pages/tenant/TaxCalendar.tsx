import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, isBefore, getDate } from "date-fns";
import { sr } from "date-fns/locale";

interface TaxDeadline {
  day: number;
  name: string;
  form: string;
  frequency: "monthly" | "quarterly" | "annual";
  months?: number[]; // for quarterly/annual
  description: string;
}

const TAX_DEADLINES: TaxDeadline[] = [
  { day: 15, name: "POPDV — Pregled obračuna PDV-a", form: "Obrazac POPDV", frequency: "monthly", description: "Podnošenje za prethodni mesec" },
  { day: 15, name: "PP-PDV — Poreska prijava PDV", form: "Obrazac PP-PDV", frequency: "monthly", description: "Podnošenje za prethodni poreski period" },
  { day: 15, name: "PPP-PD — Pojedinačna poreska prijava", form: "Obrazac PPP-PD", frequency: "monthly", description: "Porez i doprinosi na zarade za prethodni mesec" },
  { day: 15, name: "Akontacija poreza na dobit", form: "PP-AKPD", frequency: "monthly", description: "Mesečna akontacija poreza na dobit pravnih lica" },
  { day: 15, name: "Porez na imovinu — kvartalno", form: "PPI-1", frequency: "quarterly", months: [2, 5, 8, 11], description: "Kvartalni obračun poreza na imovinu" },
  { day: 31, name: "Završni račun — Bilans stanja", form: "Obrazac 1", frequency: "annual", months: [3], description: "Predaja završnog računa APR-u" },
  { day: 31, name: "Završni račun — Bilans uspeha", form: "Obrazac 2", frequency: "annual", months: [3], description: "Predaja završnog računa APR-u" },
  { day: 30, name: "Godišnji PB-1 — Porez na dobit", form: "PB-1 / PDP", frequency: "annual", months: [6], description: "Godišnja prijava poreza na dobit" },
  { day: 31, name: "Godišnji POD — Pregled obračuna doprinosa", form: "POD", frequency: "annual", months: [1], description: "Godišnji pregled za prethodnu godinu" },
  { day: 28, name: "Statistički izveštaj — RAD-1", form: "RAD-1", frequency: "monthly", description: "Mesečni statistički izveštaj o zaposlenima" },
  { day: 15, name: "eFaktura — Prijava prometa", form: "SEF", frequency: "monthly", description: "Dostava eFaktura u zakonskom roku" },
];

function getDeadlinesForMonth(year: number, month: number): (TaxDeadline & { date: Date })[] {
  return TAX_DEADLINES.filter(d => {
    if (d.frequency === "monthly") return true;
    if (d.frequency === "quarterly") return d.months?.includes(month);
    if (d.frequency === "annual") return d.months?.includes(month);
    return false;
  }).map(d => {
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(d.day, lastDay);
    return { ...d, date: new Date(year, month - 1, day) };
  });
}

export default function TaxCalendar() {
  const { t } = useLanguage();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const deadlines = useMemo(() => getDeadlinesForMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  const sortedDeadlines = [...deadlines].sort((a, b) => a.date.getTime() - b.date.getTime());

  const getStatus = (date: Date) => {
    if (isBefore(date, today) && !isSameDay(date, today)) return "past";
    if (isSameDay(date, today)) return "today";
    const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 3) return "urgent";
    return "upcoming";
  };

  const statusConfig = {
    past: { icon: CheckCircle, color: "text-muted-foreground", badge: "secondary" as const, label: "Prošao" },
    today: { icon: AlertTriangle, color: "text-destructive", badge: "destructive" as const, label: "Danas!" },
    urgent: { icon: Clock, color: "text-amber-500", badge: "default" as const, label: "Uskoro" },
    upcoming: { icon: CalendarDays, color: "text-primary", badge: "outline" as const, label: "Predstojeći" },
  };

  const monthNames = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), "LLLL", { locale: sr }));

  return (
    <div className="space-y-6">
      <PageHeader title="Poreski kalendar" description="Rokovi za poreske obaveze po zakonima Republike Srbije" icon={CalendarDays} />

      <div className="flex gap-3 items-center">
        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthNames.map((name, i) => (
              <SelectItem key={i} value={String(i + 1)}>{name.charAt(0).toUpperCase() + name.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto">
          {deadlines.length} {deadlines.length === 1 ? "rok" : "rokova"} u mesecu
        </Badge>
      </div>

      <div className="grid gap-3">
        {sortedDeadlines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nema poreskih rokova za izabrani mesec</p>
            </CardContent>
          </Card>
        ) : sortedDeadlines.map((d, i) => {
          const status = getStatus(d.date);
          const cfg = statusConfig[status];
          const Icon = cfg.icon;

          return (
            <Card key={i} className={status === "today" ? "border-destructive/50 bg-destructive/5" : status === "urgent" ? "border-amber-500/30 bg-amber-500/5" : ""}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-2xl font-bold">{getDate(d.date)}</span>
                  <span className="text-xs text-muted-foreground">{format(d.date, "EEE", { locale: sr })}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                    <span className="font-medium">{d.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{d.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={cfg.badge}>{cfg.label}</Badge>
                  <Badge variant="outline" className="text-xs font-mono">{d.form}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Napomene</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Rokovi koji padaju na neradni dan (vikend/praznik) pomeraju se na prvi naredni radni dan.</p>
          <p>• PP-PDV se podnosi za prethodni poreski period (mesečno ili tromesečno zavisno od prometa).</p>
          <p>• Za obveznike tromesečnog PDV perioda, PP-PDV se podnosi 20. u mesecu po isteku tromesečja.</p>
          <p>• Ovo je informativni pregled — proverite aktuelne rokove na sajtu Poreske uprave.</p>
        </CardContent>
      </Card>
    </div>
  );
}