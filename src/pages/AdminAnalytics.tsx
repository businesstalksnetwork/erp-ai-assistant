import { useState } from 'react';
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  CreditCard, 
  FileText, 
  BarChart3, 
  Briefcase,
  Handshake,
  DollarSign,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  trend,
  className = ''
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  description?: string;
  trend?: { value: number; positive: boolean };
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`h-3 w-3 mr-1 ${!trend.positive && 'rotate-180'}`} />
            {trend.value}% od prošlog meseca
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' RSD';
}

function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return format(date, 'MMM yyyy', { locale: sr });
}

export default function AdminAnalytics() {
  const {
    userStats,
    userGrowth,
    featureUsage,
    topUsers,
    bookkeeperStats,
    partnerStats,
    revenueStats,
    recentPayments,
    invoiceActivity,
    allUsers,
    isLoading,
    refetch,
  } = useAdminAnalytics();

  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Prepare pie chart data for user status
  const userStatusData = [
    { name: 'Aktivni (plaćeni)', value: userStats?.activePaid || 0, color: 'hsl(var(--chart-1))' },
    { name: 'Trial', value: userStats?.activeTrial || 0, color: 'hsl(var(--chart-2))' },
    { name: 'Istekao trial', value: userStats?.expiredTrial || 0, color: 'hsl(var(--chart-3))' },
    { name: 'Istekla pretplata', value: userStats?.expiredPaid || 0, color: 'hsl(var(--chart-4))' },
    { name: 'Blokirani', value: userStats?.blocked || 0, color: 'hsl(var(--chart-5))' },
  ].filter(d => d.value > 0);

  // Revenue projection calculations - using REAL data
  const estimatedMRR = revenueStats?.estimatedMRR || 0;
  // Use real commission calculations instead of generic 20%
  const estimatedCommissions = revenueStats?.estimatedCommissions || 0;
  const pendingCommissions = revenueStats?.pendingCommissions || 0;
  const referredActiveCount = revenueStats?.referredActiveCount || 0;
  const netMRR = estimatedMRR - estimatedCommissions;
  const yearlyProjection = estimatedMRR * 12;
  const yearlyNetProjection = netMRR * 12;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Analitika</h1>
          <p className="text-muted-foreground">Pregled ključnih metrika i performansi</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Osveži
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full flex overflow-x-auto scrollbar-hide gap-1 justify-start sm:grid sm:grid-cols-5 sm:overflow-visible">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Pregled</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Korisnici</span>
          </TabsTrigger>
          <TabsTrigger value="bookkeepers" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Knjigovođe</span>
          </TabsTrigger>
          <TabsTrigger value="partners" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Partneri</span>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-1.5 min-w-fit shrink-0 text-xs sm:text-sm px-2.5 sm:px-3">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Zarada</span>
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              title="Ukupno korisnika"
              value={userStats?.total || 0}
              icon={Users}
            />
            <StatCard
              title="Aktivni (plaćeni)"
              value={userStats?.activePaid || 0}
              icon={UserCheck}
              className="border-green-200 dark:border-green-800"
            />
            <StatCard
              title="Trial"
              value={userStats?.activeTrial || 0}
              icon={Clock}
              className="border-blue-200 dark:border-blue-800"
            />
            <StatCard
              title="Isteklo"
              value={(userStats?.expiredTrial || 0) + (userStats?.expiredPaid || 0)}
              icon={UserX}
              className="border-orange-200 dark:border-orange-800"
            />
            <StatCard
              title="MRR (procena)"
              value={formatCurrency(estimatedMRR)}
              icon={TrendingUp}
              className="border-emerald-200 dark:border-emerald-800"
            />
            <StatCard
              title="Ukupno faktura"
              value={invoiceActivity?.reduce((sum, m) => sum + m.value, 0) || 0}
              icon={FileText}
            />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* User Growth Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Rast korisnika po mesecima</CardTitle>
                <CardDescription>Novi korisnici registrovani po mesecu</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userGrowth || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={formatMonth}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={formatMonth}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="Novi korisnici"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Feature Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Korišćenje funkcija</CardTitle>
                <CardDescription>Procenat kompanija koje koriste svaku funkciju</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureUsage?.map((feature, index) => (
                    <div key={feature.feature} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{feature.feature}</span>
                        <span className="text-muted-foreground">
                          {feature.companies} ({feature.percentage}%)
                        </span>
                      </div>
                      <Progress 
                        value={feature.percentage} 
                        className="h-2"
                        style={{ 
                          '--progress-background': COLORS[index % COLORS.length] 
                        } as React.CSSProperties}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 najaktivnijih korisnika</CardTitle>
              <CardDescription>Korisnici sa najviše izdatih faktura</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Kompanija</TableHead>
                    <TableHead>Email korisnika</TableHead>
                    <TableHead className="text-right">Broj faktura</TableHead>
                    <TableHead className="text-right">Ukupan iznos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers?.map((user, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{user.companyName}</TableCell>
                      <TableCell className="text-muted-foreground">{user.userEmail}</TableCell>
                      <TableCell className="text-right">{user.invoiceCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(user.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {(!topUsers || topUsers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nema podataka
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-6">
          {/* User Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Ukupno korisnika"
              value={userStats?.total || 0}
              icon={Users}
              className="border-l-4 border-l-blue-500"
            />
            <StatCard
              title="Plaćeni"
              value={userStats?.activePaid || 0}
              icon={UserCheck}
              className="border-l-4 border-l-green-500"
            />
            <StatCard
              title="Promo"
              value={userStats?.promo || 0}
              icon={Handshake}
              className="border-l-4 border-l-purple-500"
            />
            <StatCard
              title="Trial"
              value={userStats?.activeTrial || 0}
              icon={Clock}
              className="border-l-4 border-l-orange-500"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* User Status Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Status korisnika</CardTitle>
                <CardDescription>Distribucija korisnika po statusu</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={userStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {userStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Registrations by Month */}
            <Card>
              <CardHeader>
                <CardTitle>Registracije po mesecima</CardTitle>
                <CardDescription>Broj novih registracija po mesecu</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userGrowth || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={formatMonth}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={formatMonth}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                        name="Registracije"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Svi korisnici</CardTitle>
              <CardDescription>Kompletna lista korisnika ({allUsers?.length || 0})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Ime</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pretplata do</TableHead>
                      <TableHead>Registrovan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers?.slice(0, 20).map((user) => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = user.subscription_end && user.subscription_end < today;
                      const isBlocked = !!user.block_reason;
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.full_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={user.account_type === 'bookkeeper' ? 'secondary' : 'outline'}>
                              {user.account_type === 'bookkeeper' ? 'Knjigovođa' : 'Paušalac'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isBlocked ? (
                              <Badge variant="destructive">Blokiran</Badge>
                            ) : user.is_trial ? (
                              <Badge variant="secondary">Trial</Badge>
                            ) : isExpired ? (
                              <Badge variant="outline" className="border-orange-500 text-orange-600">Istekao</Badge>
                            ) : (
                              <Badge className="bg-green-600">Aktivan</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.subscription_end 
                              ? format(new Date(user.subscription_end), 'dd.MM.yyyy.')
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(user.created_at), 'dd.MM.yyyy.')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {(allUsers?.length || 0) > 20 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Prikazano prvih 20 od {allUsers?.length} korisnika. Za pun pregled koristite Admin Panel.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOOKKEEPERS TAB */}
        <TabsContent value="bookkeepers" className="space-y-6">
          {/* Bookkeeper Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Ukupno knjigovođa"
              value={bookkeeperStats?.length || 0}
              icon={Briefcase}
            />
            <StatCard
              title="Ukupno klijenata"
              value={bookkeeperStats?.reduce((sum, b) => sum + b.activeClients, 0) || 0}
              icon={Users}
            />
            <StatCard
              title="Isplaćeno ukupno"
              value={formatCurrency(bookkeeperStats?.reduce((sum, b) => sum + b.totalEarned, 0) || 0)}
              icon={CreditCard}
            />
            <StatCard
              title="Čeka isplatu"
              value={formatCurrency(bookkeeperStats?.reduce((sum, b) => sum + b.pendingAmount, 0) || 0)}
              icon={Clock}
            />
          </div>

          {/* Bookkeepers Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Klijenti po knjigovođi</CardTitle>
              <CardDescription>Broj aktivnih klijenata za svakog knjigovođu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={bookkeeperStats?.map(b => ({
                      name: b.fullName || b.email.split('@')[0],
                      clients: b.activeClients,
                      referrals: b.referrals,
                    })) || []}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={150} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="clients" fill="hsl(var(--primary))" name="Klijenti" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bookkeepers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rang lista knjigovođa</CardTitle>
              <CardDescription>Detaljan pregled svih knjigovođa i njihovih performansi</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Knjigovođa</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Klijenti</TableHead>
                    <TableHead className="text-right">Doveli usera</TableHead>
                    <TableHead className="text-right">Zarada</TableHead>
                    <TableHead className="text-right">Čeka isplatu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookkeeperStats?.map((bk, index) => (
                    <TableRow key={bk.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{bk.fullName || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{bk.email}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{bk.activeClients}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{bk.referrals}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(bk.totalEarned)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCurrency(bk.pendingAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!bookkeeperStats || bookkeeperStats.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nema registrovanih knjigovođa
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PARTNERS TAB */}
        <TabsContent value="partners" className="space-y-6">
          {/* Partner Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Aktivnih partnera"
              value={partnerStats?.length || 0}
              icon={Handshake}
            />
            <StatCard
              title="Ukupno dovedenih"
              value={partnerStats?.reduce((sum, p) => sum + p.totalUsers, 0) || 0}
              icon={Users}
            />
            <StatCard
              title="Konvertovanih u paid"
              value={partnerStats?.reduce((sum, p) => sum + p.paidUsers, 0) || 0}
              icon={CreditCard}
            />
            <StatCard
              title="Prosečna konverzija"
              value={`${Math.round(
                (partnerStats?.reduce((sum, p) => sum + p.conversionRate, 0) || 0) / 
                Math.max(partnerStats?.length || 1, 1)
              )}%`}
              icon={Percent}
            />
          </div>

          {/* Partners Table */}
          <Card>
            <CardHeader>
              <CardTitle>Performanse partnera</CardTitle>
              <CardDescription>Pregled svih partnerskih programa i njihovih rezultata</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Kod</TableHead>
                    <TableHead className="text-right">Popust</TableHead>
                    <TableHead className="text-right">Dovedeno</TableHead>
                    <TableHead className="text-right">Plaćenih</TableHead>
                    <TableHead className="text-right">Trial</TableHead>
                    <TableHead className="text-right">Konverzija</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerStats?.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{partner.code}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {partner.discountPercent ? `${partner.discountPercent}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right">{partner.totalUsers}</TableCell>
                      <TableCell className="text-right text-green-600">{partner.paidUsers}</TableCell>
                      <TableCell className="text-right text-blue-600">{partner.trialUsers}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={partner.conversionRate > 50 ? 'default' : 'secondary'}>
                          {partner.conversionRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!partnerStats || partnerStats.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nema aktivnih partnera
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="space-y-6">
          {/* Revenue Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Ukupna zarada"
              value={formatCurrency(revenueStats?.totalRevenue || 0)}
              icon={DollarSign}
            />
            <StatCard
              title="Ovaj mesec"
              value={formatCurrency(revenueStats?.thisMonthRevenue || 0)}
              icon={TrendingUp}
            />
            <StatCard
              title="Prošli mesec"
              value={formatCurrency(revenueStats?.lastMonthRevenue || 0)}
              icon={CreditCard}
            />
            <StatCard
              title="MRR (procena)"
              value={formatCurrency(estimatedMRR)}
              icon={BarChart3}
            />
          </div>

          {/* Revenue Projections */}
          <Card>
            <CardHeader>
              <CardTitle>Projekcije zarade</CardTitle>
              <CardDescription>Procena mesečnih i godišnjih prihoda</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Mesečna projekcija</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Bruto MRR:</span>
                      <span className="font-medium">{formatCurrency(estimatedMRR)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>- Provizije ({referredActiveCount} referiranih korisnika):</span>
                      <span>{formatCurrency(estimatedCommissions)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>= Neto MRR:</span>
                      <span className="text-green-600">{formatCurrency(netMRR)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Godišnja projekcija</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Bruto godišnje:</span>
                      <span className="font-medium">{formatCurrency(yearlyProjection)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>- Provizije godišnje:</span>
                      <span>{formatCurrency(estimatedCommissions * 12)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>= Neto godišnje:</span>
                      <span className="text-green-600">{formatCurrency(yearlyNetProjection)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Mesečna zarada</CardTitle>
              <CardDescription>Prihodi od pretplata po mesecima</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {revenueStats?.monthlyData && revenueStats.monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueStats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={formatMonth}
                        className="text-xs"
                      />
                      <YAxis 
                        className="text-xs"
                        tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                      />
                      <Tooltip 
                        labelFormatter={formatMonth}
                        formatter={(value: number) => [formatCurrency(value), 'Zarada']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="hsl(var(--chart-1))" 
                        radius={[4, 4, 0, 0]}
                        name="Zarada"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nema podataka o uplatama
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Poslednje uplate</CardTitle>
              <CardDescription>Istorija uplata pretplata</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Korisnik</TableHead>
                    <TableHead className="text-right">Meseci</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead className="text-right">Popust</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments?.slice(0, 20).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.paymentDate), 'dd.MM.yyyy.')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.userName || '-'}</div>
                          <div className="text-xs text-muted-foreground">{payment.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{payment.months}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.discountPercent ? (
                          <Badge variant="secondary">{payment.discountPercent}%</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.adminEmail || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!recentPayments || recentPayments.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nema evidentiranih uplata
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
