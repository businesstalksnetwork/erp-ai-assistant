import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, CreditCard, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { PayoutDialog } from '@/components/PayoutDialog';
import { useBookkeeperPayouts, BookkeeperPayout } from '@/hooks/useBookkeeperPayouts';
import { useAuth } from '@/lib/auth';
// @ts-nocheck
export default function Payouts() {
  const { user } = useAuth();
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<BookkeeperPayout | null>(null);
  
  const {
    pendingPayouts,
    payoutHistory,
    isLoadingPending,
    isLoadingHistory,
    markAsPaid,
    totalPending,
    totalPaidThisMonth,
    bookkeeperCount,
  } = useBookkeeperPayouts();

  const handleMarkAsPaid = (bookkeeperIds: string[]) => {
    if (user) {
      markAsPaid.mutate({ bookkeeperIds, adminId: user.id });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Isplata provizija
        </h1>
        <p className="text-muted-foreground">
          Upravljanje isplatama provizija za knjigovođe
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Čeka isplatu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalPending.toLocaleString('sr-RS')} RSD</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aktivnih knjigovođa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookkeeperCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Isplaćeno ovog meseca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPaidThisMonth.toLocaleString('sr-RS')} RSD</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending isplate</CardTitle>
          <CardDescription>
            Knjigovođe koje čekaju isplatu provizije
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : pendingPayouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nema pending isplata</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Knjigovođa</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Račun</TableHead>
                  <TableHead className="text-right">Iznos</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayouts.map((payout) => (
                  <TableRow key={payout.bookkeeper_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payout.bookkeeper_name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{payout.bookkeeper_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {payout.bookkeeper_company_name || (
                        <span className="text-amber-600 text-sm">Nije popunjeno</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payout.bookkeeper_bank_account || '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {payout.pending_amount.toLocaleString('sr-RS')} RSD
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        onClick={() => { setSelectedPayout(payout); setPayoutDialogOpen(true); }}
                      >
                        Generiši nalog
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      {payoutHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Istorija isplata</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Knjigovođa</TableHead>
                  <TableHead className="text-right">Iznos</TableHead>
                  <TableHead className="text-right">Stavki</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutHistory.slice(0, 20).map((history) => (
                  <TableRow key={history.id}>
                    <TableCell>{format(new Date(history.paid_at), 'dd.MM.yyyy.')}</TableCell>
                    <TableCell>{history.bookkeeper_name || history.bookkeeper_email}</TableCell>
                    <TableCell className="text-right font-medium">{history.total_amount.toLocaleString('sr-RS')} RSD</TableCell>
                    <TableCell className="text-right">{history.earnings_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payout Dialog */}
      <PayoutDialog
        open={payoutDialogOpen}
        onOpenChange={setPayoutDialogOpen}
        payout={selectedPayout}
        isMarking={markAsPaid.isPending}
        onMarkAsPaid={() => {
          if (selectedPayout) {
            handleMarkAsPaid([selectedPayout.bookkeeper_id]);
          }
        }}
      />
    </div>
  );
}
