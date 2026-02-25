import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Tag, GripVertical, Check, CornerDownRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

interface CompanyCategory {
  id: string;
  code: string;
  name: string;
  name_sr: string | null;
  color: string | null;
  is_system: boolean | null;
  sort_order: number | null;
  tenant_id: string;
  parent_id: string | null;
}

interface HierarchicalCategory extends CompanyCategory {
  children: HierarchicalCategory[];
  level: number;
}

const defaultColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1',
];

export default function CompanyCategoriesSettings() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CompanyCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<CompanyCategory | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    name_sr: '',
    color: defaultColors[0],
    parent_id: '',
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['company-categories', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order');
      if (error) throw error;
      return data as CompanyCategory[];
    },
    enabled: !!tenantId,
  });

  const { data: categoriesInUse } = useQuery({
    queryKey: ['categories-in-use', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_category_assignments')
        .select('category_id, partners(id, name, display_name, type)')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      const map = new Map<string, Array<{ id: string; name: string; type: string }>>();
      data?.forEach((a: any) => {
        if (!a.partners) return;
        const list = map.get(a.category_id) || [];
        list.push({ id: a.partners.id, name: a.partners.display_name || a.partners.name, type: a.partners.type });
        map.set(a.category_id, list);
      });
      return map;
    },
    enabled: !!tenantId,
  });

  const TYPE_BADGE_COLORS: Record<string, string> = {
    customer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    supplier: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    both: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  const hierarchicalCategories = useMemo(() => {
    if (!categories) return [];
    const buildTree = (parentId: string | null, level: number): HierarchicalCategory[] => {
      return categories
        .filter(cat => cat.parent_id === parentId)
        .map(cat => ({
          ...cat,
          level,
          children: buildTree(cat.id, level + 1),
        }));
    };
    const flatten = (items: HierarchicalCategory[]): HierarchicalCategory[] => {
      return items.flatMap(item => [item, ...flatten(item.children)]);
    };
    return flatten(buildTree(null, 0));
  }, [categories]);

  const topLevelCategories = useMemo(() => {
    return categories?.filter(cat => !cat.parent_id) || [];
  }, [categories]);

  const availableParents = useMemo(() => {
    if (!categories || !editingCategory) return topLevelCategories;
    const getDescendantIds = (parentId: string): string[] => {
      const children = categories.filter(cat => cat.parent_id === parentId);
      return children.flatMap(child => [child.id, ...getDescendantIds(child.id)]);
    };
    const excludeIds = new Set([editingCategory.id, ...getDescendantIds(editingCategory.id)]);
    return categories.filter(cat => !excludeIds.has(cat.id) && !cat.parent_id);
  }, [categories, editingCategory, topLevelCategories]);

  const hasChildren = (categoryId: string) => {
    return categories?.some(cat => cat.parent_id === categoryId) || false;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!tenantId) throw new Error('No tenant');
      const maxOrder = categories?.reduce((max, c) => Math.max(max, c.sort_order || 0), 0) || 0;
      const { error } = await supabase.from('company_categories').insert({
        code: data.code.toLowerCase().replace(/\s+/g, '_'),
        name: data.name,
        name_sr: data.name_sr,
        color: data.color,
        is_system: false,
        sort_order: maxOrder + 1,
        tenant_id: tenantId,
        parent_id: data.parent_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] });
      toast({ title: t("categoryCreated") });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.message?.includes('unique')) {
        toast({ title: t("error"), description: t("duplicateCode"), variant: "destructive" });
      } else {
        toast({ title: t("error"), description: error.message, variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('company_categories')
        .update({
          code: data.code.toLowerCase().replace(/\s+/g, '_'),
          name: data.name,
          name_sr: data.name_sr,
          color: data.color,
          parent_id: data.parent_id || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] });
      toast({ title: t("categoryUpdated") });
      setEditingCategory(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-in-use'] });
      toast({ title: t("categoryDeleted") });
      setDeleteCategory(null);
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      name_sr: '',
      color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
      parent_id: '',
    });
  };

  const openEditDialog = (category: CompanyCategory) => {
    setFormData({
      code: category.code,
      name: category.name,
      name_sr: category.name_sr || '',
      color: category.color || defaultColors[0],
      parent_id: category.parent_id || '',
    });
    setEditingCategory(category);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.name_sr.trim()) {
      toast({ title: t("error"), description: t("codeNameRequired"), variant: "destructive" });
      return;
    }
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const canDelete = (category: CompanyCategory) => {
    if (category.is_system) return false;
    if (hasChildren(category.id)) return false;
    const partners = categoriesInUse?.get(category.id);
    return !partners || partners.length === 0;
  };

  const getDeleteTooltip = (category: CompanyCategory) => {
    if (category.is_system) return t('cannotDeleteSystem');
    if (hasChildren(category.id)) return t('cannotDeleteHasChildren');
    if (categoriesInUse?.get(category.id)?.length) return t('cannotDeleteInUse');
    return t('delete');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const CategoryForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>{t('parentCategory')}</Label>
        <Select
          value={formData.parent_id || 'none'}
          onValueChange={(value) => setFormData({ ...formData, parent_id: value === 'none' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('noParent')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('noParent')}</SelectItem>
            {(isEdit ? availableParents : topLevelCategories).map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#888' }} />
                  {cat.name_sr || cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t('categoryNameSr')} *</Label>
        <Input
          value={formData.name_sr}
          onChange={(e) => setFormData({ ...formData, name_sr: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('categoryNameEn')} *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('categoryCode')} *</Label>
        <Input
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          disabled={isEdit && editingCategory?.is_system === true}
        />
        {isEdit && editingCategory?.is_system ? (
          <p className="text-xs text-muted-foreground">{t("systemCodeNote")}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("uniqueIdNote")}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>{t('categoryColor')}</Label>
        <div className="flex flex-wrap gap-2">
          {defaultColors.map((color) => (
            <button
              key={color}
              type="button"
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: formData.color === color ? 'white' : 'transparent',
                boxShadow: formData.color === color ? `0 0 0 2px ${color}` : 'none',
              }}
              onClick={() => setFormData({ ...formData, color })}
            >
              {formData.color === color && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('partnerCategories')} icon={Tag} description={t('partnerCategories')} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {t('partnerCategories')}
              </CardTitle>
              <CardDescription>
                {t("manageCategoriesDesc")}
              </CardDescription>
            </div>
            <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('newCategory')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{t('newCategory')}</DialogTitle>
                    <DialogDescription>{t("createCategoryDesc")}</DialogDescription>
                  </DialogHeader>
                  <CategoryForm />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>{t('cancel')}</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? t('saving') : t('save')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('categoryCode')}</TableHead>
                <TableHead>{t('categoryColor')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hierarchicalCategories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${category.level * 24}px` }}>
                      {category.level > 0 && <CornerDownRight className="h-4 w-4 text-muted-foreground" />}
                      {category.name_sr || category.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{category.code}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color || '#888' }} />
                      <span className="text-xs text-muted-foreground">{category.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={category.is_system ? 'secondary' : 'outline'}>
                        {category.is_system ? t('systemCategory') : t('userCategory')}
                      </Badge>
                      {category.level > 0 && (
                        <Badge variant="outline" className="text-xs">{t('subcategory')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canDelete(category)}
                        onClick={() => setDeleteCategory(category)}
                        title={getDeleteTooltip(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!categories || categories.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t("noCategories")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => { if (!open) { setEditingCategory(null); resetForm(); } }}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t('editCategory')}</DialogTitle>
            </DialogHeader>
            <CategoryForm isEdit />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditingCategory(null); resetForm(); }}>{t('cancel')}</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmation')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
