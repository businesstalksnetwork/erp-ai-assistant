import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, FileText, Store, BookOpen, Target, AlertTriangle } from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useLimitChartData, MonthlyChartData } from '@/hooks/useLimitChartData';
import { LimitsData } from '@/hooks/useLimits';

function formatCurrencyShort(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return amount.toFixed(0);
}

function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as MonthlyChartData;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-xl text-xs space-y-1.5">
      <p className="font-semibold text-sm">{data.monthLabel}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Mesečni promet:</span>
        <span className="font-medium">{formatCurrencyFull(data.total)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Kumulativno:</span>
        <span className="font-semibold text-primary">{formatCurrencyFull(data.cumulative)}</span>
      </div>
      {data.invoices > 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <span>↳ Fakture:</span>
          <span>{formatCurrencyFull(data.invoices)}</span>
        </div>
      )}
      {data.fiscal > 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <span>↳ Fiskalna kasa:</span>
          <span>{formatCurrencyFull(data.fiscal)}</span>
        </div>
      )}
      {data.kpo > 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <span>↳ KPO (uvoz):</span>
          <span>{formatCurrencyFull(data.kpo)}</span>
        </div>
      )}
    </div>
  );
}

interface LimitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: '6m' | '8m';
  limits: LimitsData;
  limit6M: number;
  limit8M: number;
  invoices: any[];
  dailySummaries: any[];
  kpoEntries?: any[];
}

export default function LimitDetailDialog({
  open,
  onOpenChange,
  limitType,
  limits,
  limit6M,
  limit8M,
  invoices,
  dailySummaries,
  kpoEntries,
}: LimitDetailDialogProps) {
  const chartData = useLimitChartData(limitType, invoices, dailySummaries, kpoEntries);

  const limit = limitType === '6m' ? limit6M : limit8M;
  const percent = limitType === '6m' ? limits.limit6MPercent : limits.limit8MPercent;
  const remaining = limitType === '6m' ? limits.limit6MRemaining : limits.limit8MRemaining;
  const currentTotal = limitType === '6m' ? limits.yearlyTotal : limits.rollingDomestic;
  const warningLine = limit * 0.8;

  // Breakdown totals from chart data
  const breakdown = useMemo(() => {
    const totals = chartData.reduce(
      (acc, d) => ({
        invoices: acc.invoices + d.invoices,
        fiscal: acc.fiscal + d.fiscal,
        kpo: acc.kpo + d.kpo,
        total: acc.total + d.total,
      }),
      { invoices: 0, fiscal: 0, kpo: 0, total: 0 },
    );
    return totals;
  }, [chartData]);

  const statusColor =
    percent >= 90
      ? 'text-destructive'
      : percent >= 75
        ? 'text-warning'
        : 'text-primary';

  const statusBadge =
    percent >= 90
      ? 'destructive'
      : percent >= 75
        ? 'warning'
        : 'default';

  // Calculate max Y for chart (at least the limit value, + 10% padding)
  const maxCumulative = Math.max(...chartData.map((d) => d.cumulative), 0);
  const yMax = Math.max(maxCumulative * 1.1, limit * 1.15);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                percent >= 90
                  ? 'bg-destructive/10'
                  : percent >= 75
                    ? 'bg-warning/10'
                    : 'bg-primary/10',
              )}
            >
              <Target className={cn('h-5 w-5', statusColor)} />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {limitType === '6m' ? 'Godišnji limit (6M)' : 'Klizni limit (8M)'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {limitType === '6m'
                  ? `01.01. - 31.12. ${new Date().getFullYear()}.`
                  : 'Poslednjih 365 dana'}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={statusBadge as any} className="text-sm">
              {percent.toFixed(1)}%
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatCurrencyFull(currentTotal)} / {formatCurrencyFull(limit)}
            </span>
          </div>
        </DialogHeader>

        {/* Chart */}
        <div className="mt-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="invoicesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fiscalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="kpoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, yMax]}
                tickFormatter={(v) => formatCurrencyShort(v)}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Warning line at 80% */}
              <ReferenceLine
                y={warningLine}
                stroke="hsl(var(--warning))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: '80%',
                  position: 'right',
                  fill: 'hsl(var(--warning))',
                  fontSize: 11,
                }}
              />
              {/* Limit line */}
              <ReferenceLine
                y={limit}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: formatCurrencyShort(limit),
                  position: 'right',
                  fill: 'hsl(var(--destructive))',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />

              {/* Stacked areas by category */}
              {limitType === '8m' && (
                <Area
                  type="monotone"
                  dataKey="kpo"
                  stackId="monthly"
                  stroke="hsl(var(--warning))"
                  strokeWidth={1.5}
                  fill="url(#kpoGradient)"
                  animationDuration={1200}
                />
              )}
              <Area
                type="monotone"
                dataKey="fiscal"
                stackId="monthly"
                stroke="hsl(var(--success))"
                strokeWidth={1.5}
                fill="url(#fiscalGradient)"
                animationDuration={1200}
              />
              <Area
                type="monotone"
                dataKey="invoices"
                stackId="monthly"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill="url(#invoicesGradient)"
                animationDuration={1200}
              />

              {/* Cumulative line overlay */}
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={{ r: 2.5, fill: 'hsl(var(--foreground))', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: 'hsl(var(--foreground))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
              <span>Fakture</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-success" />
              <span>Fiskalna kasa</span>
            </div>
            {limitType === '8m' && (
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-warning" />
                <span>KPO</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-foreground rounded" />
              <span>Kumulativno</span>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <BreakdownCard
            icon={FileText}
            label="Fakture"
            amount={breakdown.invoices}
            total={breakdown.total}
            color="text-primary"
            bgColor="bg-primary/10"
          />
          <BreakdownCard
            icon={Store}
            label="Fiskalna kasa"
            amount={breakdown.fiscal}
            total={breakdown.total}
            color="text-success"
            bgColor="bg-success/10"
          />
          {limitType === '8m' && (
            <BreakdownCard
              icon={BookOpen}
              label="KPO (uvoz)"
              amount={breakdown.kpo}
              total={breakdown.total}
              color="text-warning"
              bgColor="bg-warning/10"
            />
          )}
        </div>

        {/* Monthly breakdown table */}
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Pregled po mesecima</p>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-medium text-muted-foreground">Mesec</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Fakture</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Fiskalna</th>
                    {limitType === '8m' && (
                      <th className="text-right p-2 font-medium text-muted-foreground">KPO</th>
                    )}
                    <th className="text-right p-2 font-medium text-muted-foreground">Ukupno</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Kumulativ</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.filter(d => d.total > 0 || d.cumulative > 0).length === 0 ? (
                    <tr>
                      <td colSpan={limitType === '8m' ? 6 : 5} className="text-center p-4 text-muted-foreground">
                        Nema podataka za prikaz
                      </td>
                    </tr>
                  ) : (
                    chartData.map((d, i) => (
                      <tr
                        key={d.month}
                        className={cn(
                          'border-t border-border/50 transition-colors',
                          d.total > 0 ? 'hover:bg-muted/30' : 'text-muted-foreground/50',
                        )}
                      >
                        <td className="p-2 font-medium capitalize">{d.monthLabel}</td>
                        <td className="text-right p-2 tabular-nums">
                          {d.invoices > 0 ? formatCurrencyFull(d.invoices) : '—'}
                        </td>
                        <td className="text-right p-2 tabular-nums">
                          {d.fiscal > 0 ? formatCurrencyFull(d.fiscal) : '—'}
                        </td>
                        {limitType === '8m' && (
                          <td className="text-right p-2 tabular-nums">
                            {d.kpo > 0 ? formatCurrencyFull(d.kpo) : '—'}
                          </td>
                        )}
                        <td className="text-right p-2 tabular-nums font-medium">
                          {d.total > 0 ? formatCurrencyFull(d.total) : '—'}
                        </td>
                        <td className={cn(
                          'text-right p-2 tabular-nums font-semibold',
                          d.cumulative > 0 ? 'text-primary' : '',
                        )}>
                          {d.cumulative > 0 ? formatCurrencyFull(d.cumulative) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Footer info */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Preostalo do limita:
            </span>
            <span className={cn('font-semibold', statusColor)}>
              {formatCurrencyFull(remaining)}
            </span>
          </div>
          {percent >= 75 && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              <span>
                {percent >= 90
                  ? 'Kritičan nivo - približavate se zakonskom limitu!'
                  : 'Upozorenje - prešli ste 75% limita.'}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BreakdownCard({
  icon: Icon,
  label,
  amount,
  total,
  color,
  bgColor,
}: {
  icon: any;
  label: string;
  amount: number;
  total: number;
  color: string;
  bgColor: string;
}) {
  const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';

  return (
    <Card className="border">
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-md shrink-0', bgColor)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold truncate">{formatCurrencyFull(amount)}</p>
          <p className="text-[10px] text-muted-foreground">{pct}% ukupnog</p>
        </div>
      </CardContent>
    </Card>
  );
}
