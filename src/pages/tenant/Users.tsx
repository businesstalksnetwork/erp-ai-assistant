import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, UserMinus, Mail, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Constants } from "@/integrations/supabase/types";

const ASSIGNABLE_ROLES = Constants.public.Enums.app_role.filter(r => r !== "super_admin");

export default function TenantUsers() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("user");

  // Fetch members with profiles
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["tenant-members", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_members")
        .select("id, user_id, role, status, created_at")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = data.map(m => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      profs?.forEach(p => { profileMap[p.id] = p.full_name || ""; });

      return data.map(m => ({
        ...m,
        full_name: profileMap[m.user_id] || "",
      }));
    },
    enabled: !!tenantId,
  });

  // Fetch invitations
  const { data: invitations, isLoading: invLoading } = useQuery({
    queryKey: ["tenant-invitations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_invitations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Invite user
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const { error } = await supabase.from("tenant_invitations").insert({
        tenant_id: tenantId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole as any,
        invited_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success"), description: t("invitationSent") });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations"] });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Change role
  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: string }) => {
      const { error } = await supabase
        .from("tenant_members")
        .update({ role: newRole as any })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success") });
      queryClient.invalidateQueries({ queryKey: ["tenant-members"] });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Remove member
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("tenant_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success") });
      queryClient.invalidateQueries({ queryKey: ["tenant-members"] });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Cancel invitation
  const cancelInvMutation = useMutation({
    mutationFn: async (invId: string) => {
      const { error } = await supabase
        .from("tenant_invitations")
        .update({ status: "cancelled" })
        .eq("id", invId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations"] });
    },
  });

  const isLoading = membersLoading || invLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("users")}</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />{t("inviteUser")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("inviteUser")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("email")}</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("roles")}</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>{t("cancel")}</Button>
              <Button onClick={() => inviteMutation.mutate()} disabled={!inviteEmail.trim() || inviteMutation.isPending}>
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                {t("inviteUser")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Members */}
      <Card>
        <CardHeader><CardTitle>{t("teamMembers")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("roles")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name || member.user_id.slice(0, 8) + "…"}
                      {member.user_id === user?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">{t("you")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={v => changeRoleMutation.mutate({ memberId: member.id, newRole: v })}
                        disabled={member.user_id === user?.id}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === "active" ? "default" : "secondary"}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(member.created_at), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.user_id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("confirm")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("removeMemberConfirm")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMutation.mutate(member.id)}>
                                {t("confirm")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {(invitations?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />{t("pendingInvitations")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("roles")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("expiresAt")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations?.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell><Badge variant="outline">{inv.role}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(inv.created_at), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(inv.expires_at), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => cancelInvMutation.mutate(inv.id)}>
                        {t("cancel")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
