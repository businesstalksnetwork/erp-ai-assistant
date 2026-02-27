import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { ProfilePersonalCard } from "@/components/profile/ProfilePersonalCard";
import { ProfileContractCard } from "@/components/profile/ProfileContractCard";
import { ProfileSalaryCard } from "@/components/profile/ProfileSalaryCard";
import { ProfileAllowancesCard } from "@/components/profile/ProfileAllowancesCard";
import { ProfileDeductionsCard } from "@/components/profile/ProfileDeductionsCard";
import { ProfileInsuranceCard } from "@/components/profile/ProfileInsuranceCard";
import { ProfileLeaveCard } from "@/components/profile/ProfileLeaveCard";
import { ProfileAttendanceCard } from "@/components/profile/ProfileAttendanceCard";
import { ProfileReversesCard } from "@/components/profile/ProfileReversesCard";
import { LeaveRequestHistory } from "@/components/profile/LeaveRequestHistory";
import { EmployeeAssetsTab } from "@/components/assets/EmployeeAssetsTab";
import { toast } from "sonner";
import {
  User, Lock, Shield, Bell, Briefcase, UserCheck, FileText,
  DollarSign, CalendarDays, Clock, Package, Mail
} from "lucide-react";

export default function Profile() {
  const { t } = useLanguage();
  const { user, roles, isSuperAdmin } = useAuth();
  const { tenantId } = useTenant();

  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.display_name || ""
  );
  const [savingName, setSavingName] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [posPin, setPosPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const { data: salesperson, refetch: refetchSalesperson } = useQuery({
    queryKey: ["my-salesperson", tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user) return null;
      const { data } = await (supabase.from("salespeople") as any)
        .select("id, first_name, last_name, pos_pin")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!user,
  });

  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee", tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user) return null;
      const { data } = await supabase
        .from("employees")
        .select("*, departments!employees_department_id_fkey(name), locations(name), manager:employees!employees_manager_id_fkey(full_name)")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!user,
  });

  const handleUpdateName = async () => {
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
    setSavingName(false);
    if (error) toast.error(error.message);
    else toast.success(t("profileUpdated"));
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error(t("passwordTooShort")); return; }
    if (newPassword !== confirmPassword) { toast.error(t("passwordsDoNotMatch")); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) toast.error(error.message);
    else { toast.success(t("passwordChanged")); setNewPassword(""); setConfirmPassword(""); }
  };

  const handleSavePin = async () => {
    if (posPin.length !== 4 || !salesperson?.id) return;
    setSavingPin(true);
    const { error } = await (supabase.from("salespeople") as any)
      .update({ pos_pin: posPin })
      .eq("id", salesperson.id);
    setSavingPin(false);
    if (error) toast.error(error.message);
    else { toast.success(t("pinSaved")); setPosPin(""); refetchSalesperson(); }
  };

  const initials = (displayName || user?.email || "U")
    .split(/[\s@]/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");

  // Super admins always see HR tabs (ghost mode), regular users only if they have an employee record
  const hasHr = !!myEmployee || isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-xl font-bold text-primary shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">
            {displayName || user?.email}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
            ))}
            {myEmployee?.position && (
              <Badge variant="outline" className="text-xs">{myEmployee.position}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={hasHr ? "overview" : "account"} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 bg-muted/50">
          {hasHr && (
            <>
              <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                <UserCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t("profilePersonalData")}</span>
                <span className="sm:hidden">{t("profilePersonalData").split(" ")[0]}</span>
              </TabsTrigger>
              <TabsTrigger value="employment" className="gap-1.5 text-xs sm:text-sm">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">{t("profileHrSection")}</span>
                <span className="sm:hidden">{t("profileHrSection")}</span>
              </TabsTrigger>
              <TabsTrigger value="finance" className="gap-1.5 text-xs sm:text-sm">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">{t("profileSalaryInfo")}</span>
                <span className="sm:hidden">{t("profileSalaryInfo")}</span>
              </TabsTrigger>
              <TabsTrigger value="assets" className="gap-1.5 text-xs sm:text-sm">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">{t("profileAssets")}</span>
                <span className="sm:hidden">{t("profileAssets")}</span>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="account" className="gap-1.5 text-xs sm:text-sm">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("accountInfo")}</span>
            <span className="sm:hidden">{t("accountInfo")}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm">
            <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">{t("notifications")}</span>
                <span className="sm:hidden">{t("notifications")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab — Personal + Attendance + Leave */}
        {hasHr && (
          <TabsContent value="overview" className="mt-6">
            {myEmployee ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProfilePersonalCard
                  employee={myEmployee}
                  departmentName={(myEmployee as any).departments?.name}
                  locationName={(myEmployee as any).locations?.name}
                  managerName={(myEmployee as any).manager?.full_name}
                />
                <div className="space-y-6">
                  <ProfileLeaveCard
                    employeeId={myEmployee.id}
                    annualLeaveDays={myEmployee.annual_leave_days}
                  />
                  <ProfileAttendanceCard employeeId={myEmployee.id} />
                  <LeaveRequestHistory employeeId={myEmployee.id} />
                </div>
              </div>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t("profileNoEmployeeRecord" as any) || "No employee record linked to this tenant."}</CardContent></Card>
            )}
          </TabsContent>
        )}

        {/* Employment Tab — Contract + Insurance */}
        {hasHr && (
          <TabsContent value="employment" className="mt-6">
            {myEmployee ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProfileContractCard employeeId={myEmployee.id} />
                <ProfileInsuranceCard employeeId={myEmployee.id} />
              </div>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t("profileNoEmployeeRecord" as any) || "No employee record linked to this tenant."}</CardContent></Card>
            )}
          </TabsContent>
        )}

        {/* Finance Tab — Salary + Allowances + Deductions */}
        {hasHr && (
          <TabsContent value="finance" className="mt-6">
            {myEmployee ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ProfileSalaryCard employeeId={myEmployee.id} />
                <ProfileAllowancesCard employeeId={myEmployee.id} />
                <ProfileDeductionsCard employeeId={myEmployee.id} />
              </div>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t("profileNoEmployeeRecord" as any) || "No employee record linked to this tenant."}</CardContent></Card>
            )}
          </TabsContent>
        )}

        {/* Assets Tab */}
        {hasHr && (
          <TabsContent value="assets" className="mt-6">
            {myEmployee ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="pt-6">
                    <EmployeeAssetsTab employeeId={myEmployee.id} />
                  </CardContent>
                </Card>
                <ProfileReversesCard employeeId={myEmployee.id} />
              </div>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t("profileNoEmployeeRecord" as any) || "No employee record linked to this tenant."}</CardContent></Card>
            )}
          </TabsContent>
        )}

        {/* Account Tab */}
        <TabsContent value="account" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Display Name */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" /> {t("displayName")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="displayName">{t("displayName")}</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <Button onClick={handleUpdateName} disabled={savingName}>
                  {savingName ? t("saving") : t("save")}
                </Button>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" /> {t("changePassword")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">{t("newPassword")}</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <Button onClick={handleChangePassword} disabled={savingPassword}>
                  {savingPassword ? t("saving") : t("changePassword")}
                </Button>
              </CardContent>
            </Card>

            {/* POS PIN */}
            {salesperson && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" /> {t("posPin")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t("posPinDescription")}</p>
                  {salesperson.pos_pin && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t("currentPin")} </span>
                      <span className="font-mono">••••</span>
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label>{salesperson.pos_pin ? t("updatePosPin") : t("setPosPin")}</Label>
                    <InputOTP maxLength={4} value={posPin} onChange={setPosPin}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button onClick={handleSavePin} disabled={savingPin || posPin.length !== 4}>
                    {savingPin ? t("saving") : t("save")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" /> {t("accountInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("email")}</span>
                  <span>{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("roles")}</span>
                  <span>{roles.join(", ") || "—"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
}
