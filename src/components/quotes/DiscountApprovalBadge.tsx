import { useDiscountApproval } from "@/hooks/useDiscountApproval";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";

interface DiscountApprovalBadgeProps {
  quoteId: string;
  tenantId: string;
  maxDiscountPct: number;
}

export function DiscountApprovalBadge({ quoteId, tenantId, maxDiscountPct }: DiscountApprovalBadgeProps) {
  const { t } = useLanguage();
  const { needsApproval, approvalStatus } = useDiscountApproval({
    tenantId,
    quoteId,
    discountPct: maxDiscountPct,
  });

  if (!needsApproval && approvalStatus === "none") return null;

  if (approvalStatus === "approved") {
    return <Badge variant="success">{t("approved")}</Badge>;
  }
  if (approvalStatus === "pending") {
    return <Badge variant="warning">{t("pendingDiscountApproval")}</Badge>;
  }
  if (approvalStatus === "rejected") {
    return <Badge variant="destructive">{t("rejected")}</Badge>;
  }
  if (needsApproval) {
    return <Badge variant="destructive">{t("discountExceedsLimit")}</Badge>;
  }

  return null;
}
