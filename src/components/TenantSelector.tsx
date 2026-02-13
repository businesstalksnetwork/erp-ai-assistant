import { useTenant } from "@/hooks/useTenant";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building } from "lucide-react";

export function TenantSelector() {
  const { tenants, tenantId, switchTenant } = useTenant();

  if (tenants.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Building className="h-4 w-4 text-muted-foreground" />
      <Select value={tenantId || ""} onValueChange={switchTenant}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tenants.map((t) => (
            <SelectItem key={t.tenantId} value={t.tenantId}>
              {t.tenantName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
