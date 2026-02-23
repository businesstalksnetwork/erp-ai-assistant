import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface UserRow {
  id: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
  tenants: { name: string; role: string }[];
}

export default function UserManagement() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);

    const [profilesRes, rolesRes, membersRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("tenant_members").select("user_id, role, tenant_id, tenants(name)"),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const members = membersRes.data || [];

    const userMap: Record<string, UserRow> = {};
    for (const p of profiles) {
      userMap[p.id] = { id: p.id, full_name: p.full_name, created_at: p.created_at, roles: [], tenants: [] };
    }
    for (const r of roles) {
      if (userMap[r.user_id]) userMap[r.user_id].roles.push(r.role);
    }
    for (const m of members) {
      if (userMap[m.user_id]) {
        userMap[m.user_id].tenants.push({
          name: (m.tenants as any)?.name || "Unknown",
          role: m.role,
        });
      }
    }

    setUsers(Object.values(userMap));
    setLoading(false);
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) ||
      u.tenants.some((t) => t.name.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("userManagement")}</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fullName")}</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>{t("tenants")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((r) => <Badge key={r} variant={r === "super_admin" ? "destructive" : "secondary"}>{r}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.tenants.map((t, i) => (
                          <Badge key={i} variant="outline">{t.name} ({t.role})</Badge>
                        ))}
                        {user.tenants.length === 0 && <span className="text-muted-foreground text-xs">No tenant</span>}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
