import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSEFRegistry } from '@/hooks/useSEFRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Trash2, Shield, Users, Clock, Calendar, Ban, CheckCircle, Search, Upload, Database, Loader2, BookUser, MoreHorizontal, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination';
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
  max_companies: number;
}

interface BookkeeperInfo {
  bookkeeper_id: string | null;
  bookkeeper_email: string;
  full_name: string | null;
  client_count: number;
  clients: { id: string; email: string; full_name: string | null }[];
  subscription_end: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_trial: boolean;
}

type FilterType = 'all' | 'active' | 'trial' | 'expired' | 'blocked';

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getRegistryStats } = useSEFRegistry();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [extendUser, setExtendUser] = useState<UserProfile | null>(null);
  const [blockUser, setBlockUser] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookkeeperSearch, setBookkeeperSearch] = useState('');
  
  // SEF Registry Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [clearExisting, setClearExisting] = useState(true);

  // Pagination state - Users
  const [usersCurrentPage, setUsersCurrentPage] = useState(1);
  const [usersItemsPerPage, setUsersItemsPerPage] = useState(10);

  // Pagination state - Bookkeepers
  const [bookkeepersCurrentPage, setBookkeepersCurrentPage] = useState(1);
  const [bookkeepersItemsPerPage, setBookkeepersItemsPerPage] = useState(10);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((u: any) => ({
        ...u,
        max_companies: u.max_companies ?? 1,
      })) as UserProfile[];
    },
  });

  // Bookkeepers query
  const { data: bookkeepers = [], isLoading: isLoadingBookkeepers } = useQuery({
    queryKey: ['admin-bookkeepers'],
    queryFn: async () => {
      // Get all accepted bookkeeper relations
      const { data: relations, error: relError } = await supabase
        .from('bookkeeper_clients')
        .select('bookkeeper_id, bookkeeper_email, client_id')
        .eq('status', 'accepted');

      if (relError) throw relError;

      // Group by bookkeeper_email
      const bookkeeperMap = new Map<string, { 
        bookkeeper_id: string | null;
        bookkeeper_email: string;
        client_ids: string[];
      }>();

      for (const rel of relations || []) {
        const existing = bookkeeperMap.get(rel.bookkeeper_email);
        if (existing) {
          existing.client_ids.push(rel.client_id);
          if (!existing.bookkeeper_id && rel.bookkeeper_id) {
            existing.bookkeeper_id = rel.bookkeeper_id;
          }
        } else {
          bookkeeperMap.set(rel.bookkeeper_email, {
            bookkeeper_id: rel.bookkeeper_id,
            bookkeeper_email: rel.bookkeeper_email,
            client_ids: [rel.client_id],
          });
        }
      }

      // Get profiles for bookkeepers and clients
      const allUserIds = new Set<string>();
      for (const bk of bookkeeperMap.values()) {
        if (bk.bookkeeper_id) allUserIds.add(bk.bookkeeper_id);
        bk.client_ids.forEach(id => allUserIds.add(id));
      }

      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, email, full_name, subscription_end, status, is_trial')
        .in('id', Array.from(allUserIds));

      if (profError) throw profError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Build final bookkeeper info
      const result: BookkeeperInfo[] = [];
      for (const bk of bookkeeperMap.values()) {
        const bkProfile = bk.bookkeeper_id ? profileMap.get(bk.bookkeeper_id) : null;
        const clients = bk.client_ids.map(cid => {
          const cp = profileMap.get(cid);
          return {
            id: cid,
            email: cp?.email || 'Nepoznat',
            full_name: cp?.full_name || null,
          };
        });

        result.push({
          bookkeeper_id: bk.bookkeeper_id,
          bookkeeper_email: bk.bookkeeper_email,
          full_name: bkProfile?.full_name || null,
          client_count: clients.length,
          clients,
          subscription_end: bkProfile?.subscription_end || null,
          status: bkProfile?.status || 'pending',
          is_trial: bkProfile?.is_trial ?? true,
        });
      }

      // Sort by client count descending
      return result.sort((a, b) => b.client_count - a.client_count);
    },
  });

  // SEF Registry Stats
  const { data: sefStats, refetch: refetchSefStats } = useQuery({
    queryKey: ['sef-registry-stats'],
    queryFn: getRegistryStats,
  });

  // SEF Registry Import Handler - Chunked upload for large files
  const CHUNK_SIZE = 10000; // 10k redova po zahtevu
  
  const handleSefImport = async (file: File) => {
    setIsImporting(true);
    setImportProgress(5);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV fajl je prazan ili nema podataka');
      }
      
      const header = lines[0];
      const dataLines = lines.slice(1);
      const totalLines = dataLines.length;
      const totalChunks = Math.ceil(totalLines / CHUNK_SIZE);

      let totalImported = 0;
      let totalErrors = 0;

      setImportProgress(10);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalLines);
        const chunkLines = dataLines.slice(start, end);
        
        // Dodaj header na svaki chunk
        const csvChunk = [header, ...chunkLines].join('\n');

        const { data, error } = await supabase.functions.invoke('sef-registry-import', {
          body: { 
            csvContent: csvChunk, 
            clearExisting: i === 0 && clearExisting  // Obriši samo na prvom chunk-u
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        totalImported += data.imported || 0;
        totalErrors += data.parseErrors || 0;

        // Update progress (10% to 95%)
        const progressPercent = 10 + Math.round(((i + 1) / totalChunks) * 85);
        setImportProgress(progressPercent);
      }

      setImportProgress(100);

      toast({
        title: 'Uvoz završen',
        description: `Uvezeno ${totalImported.toLocaleString()} firmi. Grešaka pri parsiranju: ${totalErrors}`,
      });

      refetchSefStats();
    } catch (error) {
      console.error('SEF import error:', error);
      toast({
        title: 'Greška pri uvozu',
        description: error instanceof Error ? error.message : 'Nepoznata greška',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const extendSubscription = useMutation({
    mutationFn: async ({ userId, months, startDate }: { userId: string; months: number; startDate: Date }) => {
      const newEnd = addMonths(startDate, months);

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

  const setExactDate = useMutation({
    mutationFn: async ({ userId, date }: { userId: string; date: Date }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription_end: date.toISOString().split('T')[0],
          is_trial: false,
          status: 'approved',
          block_reason: null
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Datum pretplate ažuriran' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const updateMaxCompanies = useMutation({
    mutationFn: async ({ userId, maxCompanies }: { userId: string; maxCompanies: number }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ max_companies: maxCompanies } as any)
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Ograničenje broja firmi ažurirano' });
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
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
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
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="cursor-help">Blokiran</Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[200px]">{user.block_reason || 'Razlog nije naveden'}</p>
          </TooltipContent>
        </Tooltip>
      );
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

  const getBookkeeperStatusBadge = (bk: BookkeeperInfo) => {
    if (bk.status === 'rejected') {
      return <Badge variant="destructive">Blokiran</Badge>;
    }
    if (!bk.subscription_end) {
      return <Badge variant="outline">N/A</Badge>;
    }
    const daysLeft = differenceInDays(new Date(bk.subscription_end), new Date());
    if (daysLeft < 0) {
      return <Badge variant="destructive">Istekao</Badge>;
    }
    if (bk.is_trial) {
      return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning">Trial</Badge>;
    }
    return <Badge variant="outline" className="bg-success/10 text-success border-success">Aktivan</Badge>;
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

  // Filter bookkeepers
  const filteredBookkeepers = bookkeepers.filter(bk => {
    if (!bookkeeperSearch) return true;
    const searchLower = bookkeeperSearch.toLowerCase();
    return bk.bookkeeper_email.toLowerCase().includes(searchLower) ||
           bk.full_name?.toLowerCase().includes(searchLower) ||
           bk.clients.some(c => c.email.toLowerCase().includes(searchLower) || c.full_name?.toLowerCase().includes(searchLower));
  });

  // Users pagination
  const usersTotalPages = Math.ceil(filteredUsers.length / usersItemsPerPage);
  const usersStartIndex = (usersCurrentPage - 1) * usersItemsPerPage;
  const paginatedUsers = filteredUsers.slice(usersStartIndex, usersStartIndex + usersItemsPerPage);

  // Bookkeepers pagination
  const bookkeepersTotalPages = Math.ceil(filteredBookkeepers.length / bookkeepersItemsPerPage);
  const bookkeepersStartIndex = (bookkeepersCurrentPage - 1) * bookkeepersItemsPerPage;
  const paginatedBookkeepers = filteredBookkeepers.slice(bookkeepersStartIndex, bookkeepersStartIndex + bookkeepersItemsPerPage);

  // Reset page when filter/search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setUsersCurrentPage(1);
  };

  const handleFilterChange = (value: FilterType) => {
    setFilter(value);
    setUsersCurrentPage(1);
  };

  const handleUsersItemsPerPageChange = (value: string) => {
    setUsersItemsPerPage(Number(value));
    setUsersCurrentPage(1);
  };

  const handleBookkeeperSearchChange = (value: string) => {
    setBookkeeperSearch(value);
    setBookkeepersCurrentPage(1);
  };

  const handleBookkeepersItemsPerPageChange = (value: string) => {
    setBookkeepersItemsPerPage(Number(value));
    setBookkeepersCurrentPage(1);
  };

  // Helper function for page numbers
  const getPageNumbers = (currentPage: number, totalPages: number): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  // Stats
  const activeCount = users.filter(u => u.status === 'approved' && getSubscriptionInfo(u).daysLeft >= 0 && !u.is_trial).length;
  const trialCount = users.filter(u => u.is_trial && u.status !== 'rejected' && getSubscriptionInfo(u).daysLeft >= 0).length;
  const expiredCount = users.filter(u => getSubscriptionInfo(u).daysLeft < 0 && u.status !== 'rejected').length;
  const blockedCount = users.filter(u => u.status === 'rejected').length;

  return (
    <TooltipProvider>
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

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Korisnici
          </TabsTrigger>
          <TabsTrigger value="bookkeepers" className="gap-2">
            <BookUser className="h-4 w-4" />
            Knjigovođe
          </TabsTrigger>
          <TabsTrigger value="sef-registry" className="gap-2">
            <Database className="h-4 w-4" />
            SEF registar firmi
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
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
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>
                  <Select value={filter} onValueChange={(v) => handleFilterChange(v as FilterType)}>
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
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user) => (
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
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setExtendUser(user)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Uredi pretplatu
                              </DropdownMenuItem>
                              {user.status === 'rejected' ? (
                                <DropdownMenuItem onClick={() => unblockUser.mutate(user.id)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Odblokiraj
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setBlockUser(user)}>
                                  <Ban className="h-4 w-4 mr-2" />
                                  Blokiraj
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => setDeleteUserId(user.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Obriši korisnika
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nema korisnika za prikaz
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Users Pagination */}
              {filteredUsers.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Prikaži:</span>
                    <Select value={usersItemsPerPage.toString()} onValueChange={handleUsersItemsPerPageChange}>
                      <SelectTrigger className="w-[80px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">od {filteredUsers.length}</span>
                  </div>
                  
                  {usersTotalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <button 
                            onClick={() => setUsersCurrentPage(p => Math.max(1, p - 1))}
                            disabled={usersCurrentPage === 1}
                            className="flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-md hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span>Prethodna</span>
                          </button>
                        </PaginationItem>
                        {getPageNumbers(usersCurrentPage, usersTotalPages).map((page, idx) => (
                          <PaginationItem key={idx}>
                            {page === 'ellipsis' ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                onClick={() => setUsersCurrentPage(page)}
                                isActive={usersCurrentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <button 
                            onClick={() => setUsersCurrentPage(p => Math.min(usersTotalPages, p + 1))}
                            disabled={usersCurrentPage === usersTotalPages}
                            className="flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-md hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                          >
                            <span>Sledeća</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookkeepers Tab */}
        <TabsContent value="bookkeepers">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookUser className="h-5 w-5" />
                    Knjigovođe
                  </CardTitle>
                  <CardDescription>
                    {bookkeepers.length} aktivnih knjigovođa • Ukupno {bookkeepers.reduce((sum, bk) => sum + bk.client_count, 0)} klijenata
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži..."
                    value={bookkeeperSearch}
                    onChange={(e) => handleBookkeeperSearchChange(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBookkeepers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Ime</TableHead>
                          <TableHead>Broj klijenata</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Klijenti</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBookkeepers.map((bk) => (
                          <TableRow key={bk.bookkeeper_email}>
                            <TableCell className="font-medium">{bk.bookkeeper_email}</TableCell>
                            <TableCell>{bk.full_name || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{bk.client_count}</Badge>
                            </TableCell>
                            <TableCell>{getBookkeeperStatusBadge(bk)}</TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="flex flex-wrap gap-1">
                                {bk.clients.slice(0, 3).map((client) => (
                                  <Badge key={client.id} variant="outline" className="text-xs">
                                    {client.full_name || client.email.split('@')[0]}
                                  </Badge>
                                ))}
                                {bk.clients.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{bk.clients.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {paginatedBookkeepers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nema knjigovođa za prikaz
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Bookkeepers Pagination */}
                  {filteredBookkeepers.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Prikaži:</span>
                        <Select value={bookkeepersItemsPerPage.toString()} onValueChange={handleBookkeepersItemsPerPageChange}>
                          <SelectTrigger className="w-[80px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">od {filteredBookkeepers.length}</span>
                      </div>
                      
                      {bookkeepersTotalPages > 1 && (
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <button 
                                onClick={() => setBookkeepersCurrentPage(p => Math.max(1, p - 1))}
                                disabled={bookkeepersCurrentPage === 1}
                                className="flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-md hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                              >
                                <ChevronLeft className="h-4 w-4" />
                                <span>Prethodna</span>
                              </button>
                            </PaginationItem>
                            {getPageNumbers(bookkeepersCurrentPage, bookkeepersTotalPages).map((page, idx) => (
                              <PaginationItem key={idx}>
                                {page === 'ellipsis' ? (
                                  <PaginationEllipsis />
                                ) : (
                                  <PaginationLink
                                    onClick={() => setBookkeepersCurrentPage(page)}
                                    isActive={bookkeepersCurrentPage === page}
                                    className="cursor-pointer"
                                  >
                                    {page}
                                  </PaginationLink>
                                )}
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <button 
                                onClick={() => setBookkeepersCurrentPage(p => Math.min(bookkeepersTotalPages, p + 1))}
                                disabled={bookkeepersCurrentPage === bookkeepersTotalPages}
                                className="flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-md hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                              >
                                <span>Sledeća</span>
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEF Registry Tab */}
        <TabsContent value="sef-registry">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                SEF Registar firmi
              </CardTitle>
              <CardDescription>
                Upravljanje spiskom firmi registrovanih u sistemu elektronskih faktura
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Ukupno firmi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{sefStats?.total?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-600">Aktivne</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{sefStats?.active?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Obrisane</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-muted-foreground">{sefStats?.deleted?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSefImport(file);
                  }}
                />
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="clear-existing"
                    checked={clearExisting}
                    onCheckedChange={(checked) => setClearExisting(checked === true)}
                  />
                  <Label htmlFor="clear-existing" className="text-sm">
                    Obriši postojeće podatke pre uvoza
                  </Label>
                </div>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="gap-2"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isImporting ? 'Uvoz u toku...' : 'Uvezi CSV'}
                </Button>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Uvoz u toku... {importProgress}%
                    {importProgress > 10 && importProgress < 100 && (
                      <span className="ml-1">
                        (~{Math.round(270000 * (importProgress - 10) / 85).toLocaleString()} od ~270.000 firmi)
                      </span>
                    )}
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                CSV format: PIB, JBKJS, Datum registracije (DD.MM.YYYY), Datum brisanja (opciono)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Extend Subscription Dialog */}
      <ExtendSubscriptionDialog
        open={!!extendUser}
        onOpenChange={(open) => !open && setExtendUser(null)}
        user={extendUser}
        onExtend={(userId, months, startDate) => extendSubscription.mutate({ userId, months, startDate })}
        onSetExactDate={(userId, date) => setExactDate.mutate({ userId, date })}
        onUpdateMaxCompanies={(userId, maxCompanies) => updateMaxCompanies.mutate({ userId, maxCompanies })}
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
    </TooltipProvider>
  );
}
