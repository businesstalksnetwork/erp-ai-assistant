import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

interface ComplianceCheck {
  id: string;
  category: "journal" | "vat" | "invoicing" | "payroll" | "assets" | "reporting" | "general";
  severity: "error" | "warning" | "info";
  title: string;
  title_sr: string;
  description: string;
  description_sr: string;
  law_reference: string;
  affected_count: number;
  details?: any;
}

interface ComplianceResult {
  checks: ComplianceCheck[];
  stats: { total: number; errors: number; warnings: number; info: number };
  ai_summary?: string;
  priority_actions?: string[];
  checked_at: string;
}

export function useAccountingValidation(tenantId: string | null) {
  const { locale } = useLanguage();

  return useQuery<ComplianceResult>({
    queryKey: ["compliance-check", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("compliance-checker", {
        body: { tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      return data as ComplianceResult;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10, // 10 min cache
    refetchOnWindowFocus: false,
  });
}

// Inline validation for journal entries before posting
export function useJournalEntryValidation() {
  const { locale } = useLanguage();
  const sr = locale === "sr";

  return {
    validateBeforePost: (lines: Array<{ debit: number; credit: number; description?: string; accountCode?: string }>) => {
      const warnings: string[] = [];

      // Check balance
      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        warnings.push(sr
          ? `Nalog nije balansiran: duguje ${totalDebit.toFixed(2)} ≠ potražuje ${totalCredit.toFixed(2)}`
          : `Entry is not balanced: debit ${totalDebit.toFixed(2)} ≠ credit ${totalCredit.toFixed(2)}`);
      }

      // Check for empty lines
      const emptyLines = lines.filter(l => !l.debit && !l.credit);
      if (emptyLines.length > 0) {
        warnings.push(sr
          ? `${emptyLines.length} stavki bez iznosa`
          : `${emptyLines.length} lines have no amount`);
      }

      // Check for lines with both debit and credit
      const bothSides = lines.filter(l => l.debit > 0 && l.credit > 0);
      if (bothSides.length > 0) {
        warnings.push(sr
          ? `${bothSides.length} stavki ima i duguje i potražuje — koristite odvojene stavke`
          : `${bothSides.length} lines have both debit and credit — use separate lines`);
      }

      return warnings;
    },

    validateInvoice: (invoice: { total: number; tax: number; partnerPib?: string; invoiceNumber?: string; invoiceDate?: string; dueDate?: string }) => {
      const warnings: string[] = [];

      if (invoice.total > 0 && (!invoice.tax || invoice.tax === 0)) {
        warnings.push(sr
          ? "Faktura nema PDV — proverite da li je oslobođena (čl. 24/25 Zakona o PDV)"
          : "Invoice has no VAT — verify if exempt (Art. 24/25 VAT Law)");
      }

      if (!invoice.partnerPib) {
        warnings.push(sr
          ? "Nedostaje PIB kupca (obavezan za B2B prema čl. 42 Zakona o PDV)"
          : "Missing buyer PIB (required for B2B per Art. 42 VAT Law)");
      }

      // Validate invoice number format
      if (invoice.invoiceNumber && !/^\d+\/\d{4}$/.test(invoice.invoiceNumber) && !/^[A-Z]+-\d+/.test(invoice.invoiceNumber)) {
        warnings.push(sr
          ? "Broj fakture nije u standardnom formatu (npr. 001/2026 ili IF-001)"
          : "Invoice number not in standard format (e.g. 001/2026 or IF-001)");
      }

      // Check due date vs invoice date
      if (invoice.invoiceDate && invoice.dueDate && invoice.dueDate < invoice.invoiceDate) {
        warnings.push(sr
          ? "Rok plaćanja je pre datuma fakture"
          : "Due date is before invoice date");
      }

      // Serbian legal max payment term (60 days for B2B per Zakon o rokovima izmirenja novčanih obaveza)
      if (invoice.invoiceDate && invoice.dueDate) {
        const diff = Math.ceil((new Date(invoice.dueDate).getTime() - new Date(invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 60) {
          warnings.push(sr
            ? `Rok plaćanja ${diff} dana — Zakon o rokovima dozvoljava max 60 dana za B2B`
            : `Payment term ${diff} days — Serbian law allows max 60 days for B2B`);
        }
      }

      return warnings;
    },

    validatePartnerBalance: (totalDue: number, creditLimit?: number) => {
      const warnings: string[] = [];
      if (creditLimit && totalDue > creditLimit) {
        warnings.push(sr
          ? `Ukupan dug partnera (${totalDue.toFixed(2)}) prelazi kreditni limit (${creditLimit.toFixed(2)})`
          : `Partner total due (${totalDue.toFixed(2)}) exceeds credit limit (${creditLimit.toFixed(2)})`);
      }
      return warnings;
    },
  };
}
