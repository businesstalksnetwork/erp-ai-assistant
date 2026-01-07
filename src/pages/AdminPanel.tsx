import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Shield, Users, Clock, Calendar, Ban, CheckCircle, Search } from 'lucide-react';
import { format, differenceInDays, addMonths } from 'date-fns';
import { sr } from 'date-fns/locale';
import { ExtendSubscriptionDialog } from '@/components/ExtendSubscriptionDialog';
import { BlockUserDialog } from '@/components/BlockUserDialog';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  pib: string | null;
  company_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  subscription_end: string | null;
  block_reason: string | null;
  is_trial: boolean;
  created_at: string;
}

type FilterType = 'all' | 'active' | 'trial' | 'expired' | 'blocked';

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [extendUser, setExtendUser] = useState<UserProfile | null>(null);
  const [blockUser, setBlockUser] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserProfile[];
    },
  });

  const extendSubscription = useMutation({
    mutationFn: async ({ userId, months }: { userId: string; months: number }) => {
      const user = users.find(u => u.id === userId);
      if (!user) throw new Error('Korisnik nije pronađen');

      const currentEnd = user.subscription_end ? new Date(user.subscription_end) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = addMonths(baseDate, months);

      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription_end: newEnd.toISOString().split('T')[0],
          is_trial: false,
          status: 'approved',
          block_reason: null
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Pretplata produžena' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: 'rejected',
          block_reason: reason
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Korisnik blokiran' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const unblockUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: 'approved',
          block_reason: null
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Korisnik odblokiran' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Korisnik je obrisan' });
      setDeleteUserId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const getSubscriptionInfo = (user: UserProfile) => {
    if (!user.subscription_end) {
      return { label: 'Nije postavljeno', variant: 'outline' as const, daysLeft: 0 };
    }

    const daysLeft = differenceInDays(new Date(user.subscription_end), new Date());
    
    if (user.status === 'rejected') {
      return { label: 'Blokiran', variant: 'destructive' as const, daysLeft };
    }

    if (daysLeft < 0) {
      return { label: 'Istekao', variant: 'destructive' as const, daysLeft };
    }

    if (user.is_trial) {
      return { 
        label: `Trial: ${daysLeft}d`, 
        variant: 'secondary' as const, 
        daysLeft 
      };
    }

    return { 
      label: `Do ${format(new Date(user.subscription_end), 'dd.MM.yy')}`, 
      variant: 'default' as const, 
      daysLeft 
    };
  };

  const getStatusBadge = (user: UserProfile) => {
    if (user.status === 'rejected') {
      return <Badge variant="destructive">Blokiran</Badge>;
    }
    if (user.status === 'pending') {
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning">Čeka</Badge>;
    }
    
    const subInfo = getSubscriptionInfo(user);
    if (subInfo.daysLeft < 0) {
      return <Badge variant="destructive">Istekao</Badge>;
    }
    
    return <Badge variant="outline" className="bg-success/10 text-success border-success">Aktivan</Badge>;
  };

  const getSubscriptionBadge = (user: UserProfile) => {
    const info = getSubscriptionInfo(user);
    
    if (info.variant === 'destructive') {
      return <Badge variant="destructive">{info.label}</Badge>;
    }
    if (info.variant === 'secondary') {
      return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning">{info.label}</Badge>;
    }
    if (info.variant === 'default') {
      return <Badge variant="outline" className="bg-success/10 text-success border-success">{info.label}</Badge>;
    }
    return <Badge variant="outline">{info.label}</Badge>;
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const subInfo = getSubscriptionInfo(user);
    
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      user.email.toLowerCase().includes(searchLower) ||
      (user.full_name?.toLowerCase().includes(searchLower)) ||
      (user.company_name?.toLowerCase().includes(searchLower)) ||
      (user.pib?.includes(searchQuery));

    if (!matchesSearch) return false;

    // Status filter
    switch (filter) {
      case 'active':
        return user.status === 'approved' && subInfo.daysLeft >= 0 && !user.is_trial;
      case 'trial':
        return user.is_trial && user.status !== 'rejected' && subInfo.daysLeft >= 0;
      case 'expired':
        return subInfo.daysLeft < 0 && user.status !== 'rejected';
      case 'blocked':
        return user.status === 'rejected';
      default:
        return true;
    }
  });

  // Stats
  const activeCount = users.filter(u => u.status === 'approved' && getSubscriptionInfo(u).daysLeft >= 0 && !u.is_trial).length;
  const trialCount = users.filter(u => u.is_trial && u.status !== 'rejected' && getSubscriptionInfo(u).daysLeft >= 0).length;
  const expiredCount = users.filter(u => getSubscriptionInfo(u).daysLeft < 0 && u.status !== 'rejected').length;
  const blockedCount = users.filter(u => u.status === 'rejected').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground">
          Upravljanje korisnicima i pretplatama
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:border-success transition-colors" onClick={() => setFilter('active')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktivni</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-warning transition-colors" onClick={() => setFilter('trial')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trialCount}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-destructive transition-colors" onClick={() => setFilter('expired')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Istekla pretplata</CardTitle>
            <Calendar className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredCount}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-destructive transition-colors" onClick={() => setFilter('blocked')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blokirani</CardTitle>
            <Ban className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Korisnici
              </CardTitle>
              <CardDescription>
                {filteredUsers.length} od {users.length} korisnika
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi korisnici</SelectItem>
                  <SelectItem value="active">Aktivni</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Istekla pretplata</SelectItem>
                  <SelectItem value="blocked">Blokirani</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Ime</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>PIB</TableHead>
                  <TableHead>Registrovan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pretplata</TableHead>
                  <TableHead>Razlog blokiranja</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || '-'}</TableCell>
                    <TableCell>{user.company_name || '-'}</TableCell>
                    <TableCell>{user.pib || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'dd. MMM yyyy.', { locale: sr })}
                    </TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>{getSubscriptionBadge(user)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={user.block_reason || ''}>
                      {user.block_reason || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExtendUser(user)}
                          title="Produži pretplatu"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        {user.status === 'rejected' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unblockUser.mutate(user.id)}
                            title="Odblokiraj"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBlockUser(user)}
                            title="Blokiraj"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteUserId(user.id)}
                          title="Obriši"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nema korisnika za prikaz
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Extend Subscription Dialog */}
      <ExtendSubscriptionDialog
        open={!!extendUser}
        onOpenChange={(open) => !open && setExtendUser(null)}
        user={extendUser}
        onExtend={(userId, months) => extendSubscription.mutate({ userId, months })}
      />

      {/* Block User Dialog */}
      <BlockUserDialog
        open={!!blockUser}
        onOpenChange={(open) => !open && setBlockUser(null)}
        user={blockUser}
        onBlock={(userId, reason) => blockUserMutation.mutate({ userId, reason })}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši korisnika?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati korisnika i sve njegove podatke (firme, fakture, itd.).
              Ovo se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUserId && deleteUser.mutate(deleteUserId)}
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
