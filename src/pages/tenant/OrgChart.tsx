import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChevronDown, ChevronRight, User, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  department_id: string | null;
  manager_id: string | null;
  status: string;
  email: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

function buildTree(employees: Employee[], parentId: string | null): TreeNode[] {
  return employees
    .filter(e => e.manager_id === parentId)
    .map(e => ({ employee: e, children: buildTree(employees, e.id) }))
    .sort((a, b) => a.employee.last_name.localeCompare(b.employee.last_name));
}

function OrgNode({
  node,
  departments,
  depth,
  expandedIds,
  toggleExpand,
  onNavigate,
}: {
  node: TreeNode;
  departments: Department[];
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const { employee, children } = node;
  const isExpanded = expandedIds.has(employee.id);
  const hasChildren = children.length > 0;
  const dept = departments.find(d => d.id === employee.department_id);

  return (
    <div className={depth > 0 ? "ml-6 border-l border-border pl-4" : ""}>
      <div className="flex items-center gap-2 py-1.5">
        {hasChildren ? (
          <Button size="icon-sm" variant="ghost" onClick={() => toggleExpand(employee.id)}>
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        ) : (
          <span className="w-7" />
        )}
        <Card
          className="flex-1 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate(employee.id)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {employee.first_name} {employee.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {employee.position || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {dept && <Badge variant="outline" className="text-xs shrink-0">{dept.name}</Badge>}
              {hasChildren && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  <Users className="h-3 w-3 mr-1" />
                  {children.length}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {isExpanded && children.map(child => (
        <OrgNode
          key={child.employee.id}
          node={child}
          departments={departments}
          depth={depth + 1}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export default function OrgChart() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["org-chart-employees", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, position, department_id, manager_id, status, email")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!tenantId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["org-chart-departments", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("departments").select("id, name").eq("tenant_id", tenantId);
      return (data || []) as Department[];
    },
    enabled: !!tenantId,
  });

  const tree = useMemo(() => buildTree(employees, null), [employees]);

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    const matchIds = new Set<string>();

    // Find matching employees and their ancestors
    function findMatches(emp: Employee) {
      if (
        emp.first_name.toLowerCase().includes(q) ||
        emp.last_name.toLowerCase().includes(q) ||
        emp.position?.toLowerCase().includes(q)
      ) {
        matchIds.add(emp.id);
        // Add all ancestors
        let current = emp;
        while (current.manager_id) {
          matchIds.add(current.manager_id);
          current = employees.find(e => e.id === current.manager_id)!;
          if (!current) break;
        }
      }
    }
    employees.forEach(findMatches);

    function filterNodes(nodes: TreeNode[]): TreeNode[] {
      return nodes
        .filter(n => matchIds.has(n.employee.id))
        .map(n => ({ ...n, children: filterNodes(n.children) }));
    }
    return filterNodes(tree);
  }, [tree, search, employees]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(employees.map(e => e.id)));
  };

  const collapseAll = () => setExpandedIds(new Set());

  return (
    <div className="space-y-6">
      <PageHeader title={t("orgChart" as any) || "Organizaciona šema"} />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={expandAll}>{t("expandAll" as any) || "Proširi sve"}</Button>
        <Button size="sm" variant="outline" onClick={collapseAll}>{t("collapseAll" as any) || "Skupi sve"}</Button>
        <Badge variant="secondary">{employees.length} {t("employees" as any) || "zaposlenih"}</Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t("loading")}</div>
      ) : filteredTree.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("noResults" as any) || "Nema rezultata"}</div>
      ) : (
        <div className="space-y-1">
          {filteredTree.map(node => (
            <OrgNode
              key={node.employee.id}
              node={node}
              departments={departments}
              depth={0}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onNavigate={(id) => navigate(`/hr/employees/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
