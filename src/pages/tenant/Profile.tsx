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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { ProfilePersonalCard } from "@/components/profile/ProfilePersonalCard";
import { ProfileContractCard } from "@/components/profile/ProfileContractCard";
import { ProfileLeaveCard } from "@/components/profile/ProfileLeaveCard";
import { ProfileAttendanceCard } from "@/components/profile/ProfileAttendanceCard";
import { ProfileReversesCard } from "@/components/profile/ProfileReversesCard";
import { EmployeeAssetsTab } from "@/components/assets/EmployeeAssetsTab";
import { toast } from "sonner";
import { User, Lock, Info, Shield, Briefcase } from "lucide-react";

export default function Profile() {
  const { t } = useLanguage();
  const { user, roles } = useAuth();
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

  // Fetch linked salesperson record
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

  // Fetch linked employee record with department & location
  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee", tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user) return null;
      const { data } = await supabase
        .from("employees")
        .select("*, departments!employees_department_id_fkey(name), locations(name)")
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

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t("myAccount")}</h1>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            {t("accountInfo")}
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
                <span className="text-muted-foreground">Current PIN: </span>
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

      {/* HR Section - only if user has a linked employee record */}
      {myEmployee && (
        <>
          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5" />
              {t("profileHrSection" as any)}
            </h2>
          </div>

          <ProfilePersonalCard
            employee={myEmployee}
            departmentName={(myEmployee as any).departments?.name}
            locationName={(myEmployee as any).locations?.name}
          />

          <ProfileContractCard employeeId={myEmployee.id} />

          <ProfileLeaveCard
            employeeId={myEmployee.id}
            annualLeaveDays={myEmployee.annual_leave_days}
          />

          <ProfileAttendanceCard employeeId={myEmployee.id} />

          <Card>
            <CardContent className="pt-6">
              <EmployeeAssetsTab employeeId={myEmployee.id} />
            </CardContent>
          </Card>

          <ProfileReversesCard employeeId={myEmployee.id} />
        </>
      )}

      {/* Notification Preferences */}
      <div>
        <NotificationPreferences />
      </div>
    </div>
  );
}
