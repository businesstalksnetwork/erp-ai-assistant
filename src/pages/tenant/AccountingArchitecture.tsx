import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  FileText, BookOpen, Landmark, BarChart3, ShieldCheck, Layers,
  ArrowRight, ArrowDown, Receipt, CreditCard, Truck, Users, Building2, Banknote
} from "lucide-react";

interface FlowCardProps {
  title: string;
  items: { label: string; to?: string }[];
  icon: React.ElementType;
  color: string;
  onClick?: (to: string) => void;
}

function FlowCard({ title, items, icon: Icon, color, onClick }: FlowCardProps) {
  return (
    <Card className={`border-l-4 ${color} h-full`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.label}
              className={`text-xs text-muted-foreground ${item.to ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
              onClick={() => item.to && onClick?.(item.to)}
            >
              • {item.label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FlowArrow({ direction = "right" }: { direction?: "right" | "down" }) {
  if (direction === "down") {
    return (
      <div className="flex justify-center py-2">
        <ArrowDown className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="hidden lg:flex items-center px-1">
      <ArrowRight className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

export default function AccountingArchitecture() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("accountingArchitecture")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("accountingArchitectureDesc")}</p>
      </div>

      {/* Row 1: Source Documents → Posting Rules → Journal Engine */}
      <div className="flex flex-col lg:flex-row items-stretch gap-2">
        <div className="flex-1">
          <FlowCard
            title={t("sourceDocuments")}
            icon={FileText}
            color="border-l-blue-500"
            onClick={go}
            items={[
              { label: t("invoices"), to: "/accounting/invoices" },
              { label: "POS", to: "/pos/terminal" },
              { label: t("supplierInvoices"), to: "/purchasing/supplier-invoices" },
              { label: t("payroll"), to: "/hr/payroll" },
              { label: t("fixedAssets"), to: "/accounting/fixed-assets" },
              { label: t("loans"), to: "/accounting/loans" },
            ]}
          />
        </div>
        <FlowArrow />
        <div className="flex-1">
          <FlowCard
            title={t("postingRules")}
            icon={BookOpen}
            color="border-l-amber-500"
            onClick={go}
            items={[
              { label: t("postingRuleCatalog"), to: "/settings/posting-rules" },
              { label: `${t("debit")} / ${t("credit")}` },
              { label: t("accountCode") },
              { label: t("businessRules"), to: "/settings/business-rules" },
            ]}
          />
        </div>
        <FlowArrow />
        <div className="flex-1">
          <FlowCard
            title={t("journalEngine")}
            icon={Receipt}
            color="border-l-green-500"
            onClick={go}
            items={[
              { label: t("journalEntries"), to: "/accounting/journal" },
              { label: `${t("draft")} → ${t("posted")}` },
              { label: `${t("reversed")} (Storno)` },
              { label: t("journalMustBalance") },
            ]}
          />
        </div>
      </div>

      {/* Arrow down from Journal Engine */}
      <FlowArrow direction="down" />

      {/* Row 2: General Ledger */}
      <div className="max-w-md mx-auto">
        <FlowCard
          title={t("generalLedger")}
          icon={Landmark}
          color="border-l-purple-500"
          onClick={go}
          items={[
            { label: t("generalLedger"), to: "/accounting/ledger" },
            { label: t("chartOfAccounts"), to: "/accounting/chart-of-accounts" },
            { label: t("bankStatements"), to: "/accounting/bank-statements" },
            { label: t("openItems"), to: "/accounting/open-items" },
          ]}
        />
      </div>

      <FlowArrow direction="down" />

      {/* Row 3: Reports + Sub-ledgers + Tax side by side */}
      <div className="grid gap-4 md:grid-cols-3">
        <FlowCard
          title={t("financialReports")}
          icon={BarChart3}
          color="border-l-emerald-500"
          onClick={go}
          items={[
            { label: t("trialBalance"), to: "/accounting/reports/trial-balance" },
            { label: t("incomeStatement"), to: "/accounting/reports/income-statement" },
            { label: t("balanceSheet"), to: "/accounting/reports/balance-sheet" },
            { label: t("agingReports"), to: "/accounting/reports/aging" },
          ]}
        />
        <FlowCard
          title={t("subLedgers")}
          icon={Layers}
          color="border-l-orange-500"
          onClick={go}
          items={[
            { label: t("fixedAssets"), to: "/accounting/fixed-assets" },
            { label: t("openItems"), to: "/accounting/open-items" },
            { label: t("deferrals"), to: "/accounting/deferrals" },
            { label: t("loans"), to: "/accounting/loans" },
            { label: t("fxRevaluation"), to: "/accounting/fx-revaluation" },
            { label: t("kompenzacija"), to: "/accounting/kompenzacija" },
          ]}
        />
        <FlowCard
          title={t("taxCompliance")}
          icon={ShieldCheck}
          color="border-l-red-500"
          onClick={go}
          items={[
            { label: "PDV / POPDV", to: "/accounting/pdv" },
            { label: t("fiscalPeriods"), to: "/accounting/fiscal-periods" },
            { label: t("yearEndClosing"), to: "/accounting/year-end" },
            { label: "SEF e-Invoice" },
          ]}
        />
      </div>
    </div>
  );
}
