import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";

interface PostingLine {
  id: string;
  line_number: number;
  side: string;
  account_source: string;
  account_id: string | null;
  dynamic_source: string | null;
  amount_source: string;
  amount_factor: number;
  is_tax_line: boolean;
  account_code?: string;
  account_name?: string;
}

interface TAccountDisplayProps {
  lines: PostingLine[];
  accounts: { id: string; code: string; name: string }[];
}

export function TAccountDisplay({ lines, accounts }: TAccountDisplayProps) {
  const { t } = useLanguage();
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const debitLines = lines.filter((l) => l.side === "DEBIT").sort((a, b) => a.line_number - b.line_number);
  const creditLines = lines.filter((l) => l.side === "CREDIT").sort((a, b) => a.line_number - b.line_number);
  const maxRows = Math.max(debitLines.length, creditLines.length, 1);

  const renderLine = (line: PostingLine | undefined) => {
    if (!line) return <div className="h-8" />;
    const acct = line.account_id ? accountMap.get(line.account_id) : null;
    return (
      <div className="flex items-center gap-1.5 text-xs py-1">
        {line.account_source === "FIXED" ? (
          <span className="font-mono font-medium">{acct ? `${acct.code} ${acct.name}` : "?"}</span>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
            {line.dynamic_source || "DYNAMIC"}
          </Badge>
        )}
        {line.amount_source !== "FULL" && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {line.amount_source}
          </Badge>
        )}
        {line.amount_factor !== 1 && line.amount_factor != null && (
          <span className="text-muted-foreground">×{line.amount_factor}</span>
        )}
        {line.is_tax_line && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">PDV</Badge>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="grid grid-cols-2 divide-x">
        <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-center border-b">
          {t("debitSide")}
        </div>
        <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-center border-b">
          {t("creditSide")}
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="px-3 py-2 space-y-0.5">
          {Array.from({ length: maxRows }, (_, i) => (
            <div key={i}>{renderLine(debitLines[i])}</div>
          ))}
        </div>
        <div className="px-3 py-2 space-y-0.5">
          {Array.from({ length: maxRows }, (_, i) => (
            <div key={i}>{renderLine(creditLines[i])}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
