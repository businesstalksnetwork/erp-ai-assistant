import { rolePermissions, type TenantRole, type ModuleGroup } from "./rolePermissions";

export type NotificationCategory = "invoice" | "inventory" | "approval" | "hr" | "accounting";

const ALL_CATEGORIES: NotificationCategory[] = ["invoice", "inventory", "approval", "hr", "accounting"];

/** Maps module groups to notification categories */
const moduleToCategoryMap: Partial<Record<ModuleGroup, NotificationCategory>> = {
  sales: "invoice",
  crm: "invoice",
  pos: "invoice",
  inventory: "inventory",
  hr: "hr",
  accounting: "accounting",
};

/**
 * Returns the notification categories a given role should see.
 * `approval` is always included for every role.
 */
export function getNotificationCategoriesForRole(role: TenantRole): NotificationCategory[] {
  if (role === "admin" || role === "manager") return ALL_CATEGORIES;

  const modules = rolePermissions[role] || [];
  const categories = new Set<NotificationCategory>(["approval"]);

  for (const mod of modules) {
    const cat = moduleToCategoryMap[mod];
    if (cat) categories.add(cat);
  }

  // Return in stable order
  return ALL_CATEGORIES.filter((c) => categories.has(c));
}

/** Maps notification_type values from the edge function to categories */
export function getNotificationTypeCategory(notificationType: string): NotificationCategory | null {
  if (notificationType.startsWith("reminder_")) return "invoice";
  if (notificationType.startsWith("subscription_") || notificationType.startsWith("trial_")) return "approval";
  if (notificationType.startsWith("limit_")) return "accounting";
  return null;
}
