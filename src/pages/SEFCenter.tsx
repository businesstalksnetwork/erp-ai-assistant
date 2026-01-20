import { useState, useMemo } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useSEFPurchaseInvoices } from '@/hooks/useSEFPurchaseInvoices';
import { useSEFStorage, StoredSEFInvoice } from '@/hooks/useSEFStorage';
import { useSEF } from '@/hooks/useSEF';
import { useSEFLongSync } from '@/hooks/useSEFLongSync';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, X, Download, Upload, RefreshCw, Eye, FileText, Inbox, Send, Archive, Loader2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays } from 'date-fns';
import SEFInvoicePreview from '@/components/SEFInvoicePreview';

const formatCurrency = (amount: number, currency = 'RSD') => {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
};

const getStatusBadge = (status: string, localStatus?: string) => {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'New': { label: 'Nova', variant: 'default' },
    'Seen': { label: 'Viđena', variant: 'secondary' },
    'Approved': { label: 'Odobrena', variant: 'default' },
    'Rejected': { label: 'Odbijena', variant: 'destructive' },
    'Sent': { label: 'Poslata', variant: 'default' },
    'Cancelled': { label: 'Stornirana', variant: 'destructive' },
    'Storno': { label: 'Storno', variant: 'destructive' },
    'Imported': { label: 'Uvezeno', variant: 'outline' },
    'Unknown': { label: 'Nepoznato', variant: 'outline' },
  };

  const localStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'pending': { label: 'Na čekanju', variant: 'secondary' },
    'approved': { label: 'Odobreno', variant: 'default' },
    'rejected': { label: 'Odbijeno', variant: 'destructive' },
    'imported': { label: 'Uvezeno', variant: 'outline' },
  };

  const sefStatus = statusMap[status] || { label: status, variant: 'outline' as const };
  const local = localStatus ? localStatusMap[localStatus] : null;

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={sefStatus.variant}>{sefStatus.label}</Badge>
      {local && localStatus !== 'pending' && (
        <Badge variant={local.variant} className="text-xs">{local.label}</Badge>
      )}
    </div>
  );
};

export default function SEFCenter() {
  const { selectedCompany } = useSelectedCompany();
  const companyId = selectedCompany?.id || null;

  // Hooks
  const { fetchPurchaseInvoices, acceptInvoice, rejectInvoice, getInvoiceXML, enrichIncompleteInvoices, isFetching, isProcessing, isLoadingXML, isEnriching } = useSEFPurchaseInvoices();
  const { purchaseInvoices, salesInvoices, storedInvoices, isLoading, refetch, importFromXML, importFromCSV, deleteStoredInvoice, isDeleting } = useSEFStorage(companyId);
  const { activeJob, isStarting, progress, startLongSync, dismissJobStatus } = useSEFLongSync(companyId);

  // Count incomplete invoices
  const incompleteCount = purchaseInvoices.filter(inv => !inv.invoice_number || !inv.counterparty_name || inv.total_amount === 0).length;
  const { getSEFStatus } = useSEF();

  // State
  const [activeTab, setActiveTab] = useState('purchase');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Pagination state
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePerPage, setPurchasePerPage] = useState(20);
  const [salesPage, setSalesPage] = useState(1);
  const [salesPerPage, setSalesPerPage] = useState(20);
  
  // Dialogs
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewXML, setPreviewXML] = useState('');
  const [previewInvoice, setPreviewInvoice] = useState<StoredSEFInvoice | null>(null);
  
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectInvoiceId, setRejectInvoiceId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Filtered invoices by date range
  const filteredPurchaseInvoices = useMemo(() => {
    return purchaseInvoices.filter(inv => {
      const issueDate = inv.issue_date;
      if (!issueDate) return true;
      if (dateFrom && issueDate < dateFrom) return false;
      if (dateTo && issueDate > dateTo) return false;
      return true;
    });
  }, [purchaseInvoices, dateFrom, dateTo]);

  const filteredSalesInvoices = useMemo(() => {
    return salesInvoices.filter(inv => {
      const issueDate = inv.issue_date;
      if (!issueDate) return true;
      if (dateFrom && issueDate < dateFrom) return false;
      if (dateTo && issueDate > dateTo) return false;
      return true;
    });
  }, [salesInvoices, dateFrom, dateTo]);

  // Paginated invoices
  const paginatedPurchaseInvoices = useMemo(() => {
    const start = (purchasePage - 1) * purchasePerPage;
    return filteredPurchaseInvoices.slice(start, start + purchasePerPage);
  }, [filteredPurchaseInvoices, purchasePage, purchasePerPage]);

  const paginatedSalesInvoices = useMemo(() => {
    const start = (salesPage - 1) * salesPerPage;
    return filteredSalesInvoices.slice(start, start + salesPerPage);
  }, [filteredSalesInvoices, salesPage, salesPerPage]);

  const totalPurchasePages = Math.ceil(filteredPurchaseInvoices.length / purchasePerPage);
  const totalSalesPages = Math.ceil(filteredSalesInvoices.length / salesPerPage);

  // Reset to page 1 when filters change
  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setPurchasePage(1);
    setSalesPage(1);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setPurchasePage(1);
    setSalesPage(1);
  };

  // Handlers
  const handleFetchPurchase = async () => {
    if (!companyId) return;
    const result = await fetchPurchaseInvoices(companyId, dateFrom, dateTo);
    // Force refresh after edge function completes
    if (result.success) {
      setTimeout(() => refetch(), 500);
    }
  };

  const handleStartLongSync = async (invoiceType: 'purchase' | 'sales') => {
    if (!companyId) return;
    await startLongSync(companyId, invoiceType, 3);
    // Refresh after starting
    setTimeout(() => refetch(), 1000);
  };

  const handleEnrichInvoices = async () => {
    if (!companyId) return;
    const result = await enrichIncompleteInvoices(companyId);
    if (result.success) {
      setTimeout(() => refetch(), 500);
    }
  };

  const handlePreview = async (invoice: StoredSEFInvoice) => {
    if (!companyId) return;
    
    setPreviewInvoice(invoice);
    setPreviewOpen(true);
    
    if (invoice.ubl_xml) {
      setPreviewXML(invoice.ubl_xml);
    } else {
      const result = await getInvoiceXML(companyId, invoice.sef_invoice_id, invoice.invoice_type as 'purchase' | 'sales');
      if (result.success && result.xml) {
        setPreviewXML(result.xml);
        refetch();
      }
    }
  };

  const handleApprove = async (invoice: StoredSEFInvoice) => {
    if (!companyId) return;
    await acceptInvoice(companyId, invoice.sef_invoice_id);
    refetch();
  };

  const handleOpenReject = (invoiceId: string) => {
    setRejectInvoiceId(invoiceId);
    setRejectComment('');
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!companyId || !rejectInvoiceId) return;
    await rejectInvoice(companyId, rejectInvoiceId, rejectComment);
    setRejectOpen(false);
    setRejectInvoiceId(null);
    refetch();
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    
    const isCSV = importFile.name.toLowerCase().endsWith('.csv');
    const result = isCSV 
      ? await importFromCSV(importFile)
      : await importFromXML(importFile);
    
    setIsImporting(false);
    
    if (result.success || result.imported > 0) {
      setImportOpen(false);
      setImportFile(null);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4" />
        <p>Izaberite firmu da biste pristupili SEF Centru</p>
      </div>
    );
  }

  if (!(selectedCompany as any).sef_api_key) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
        <p className="text-lg font-medium mb-2">SEF API ključ nije podešen</p>
        <p className="text-muted-foreground text-center max-w-md">
          Da biste koristili SEF integraciju, potrebno je da unesete API ključ u podešavanjima firme.
        </p>
      </div>
    );
  }

  // Pagination component
  const PaginationControls = ({ 
    page, 
    setPage, 
    perPage, 
    setPerPage, 
    totalItems, 
    totalPages 
  }: { 
    page: number; 
    setPage: (p: number) => void; 
    perPage: number; 
    setPerPage: (p: number) => void; 
    totalItems: number; 
    totalPages: number; 
  }) => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
      {/* Per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Po strani:</span>
        <Select value={String(perPage)} onValueChange={(v) => {
          setPerPage(Number(v));
          setPage(1);
        }}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          Ukupno: {totalItems}
        </span>
      </div>
      
      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Prethodna</span>
        </Button>
        <span className="text-sm min-w-[100px] text-center">
          Strana {page} od {totalPages || 1}
        </span>
        <Button 
          variant="outline" 
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          <span className="hidden sm:inline mr-1">Sledeća</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">SEF Centar</h1>
          <p className="text-muted-foreground">Upravljanje elektronskim fakturama</p>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Uvezi XML/CSV
        </Button>
      </div>

      {/* Global Sync Status - ALWAYS VISIBLE */}
      {activeJob && (
        <Card className={
          activeJob.status === 'running' || activeJob.status === 'pending'
            ? "border-primary/20 bg-primary/5"
            : activeJob.status === 'completed' || activeJob.status === 'partial'
            ? "border-green-500/20 bg-green-500/5"
            : "border-destructive/20 bg-destructive/5"
        }>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(activeJob.status === 'running' || activeJob.status === 'pending') && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {(activeJob.status === 'completed' || activeJob.status === 'partial') && (
                  <Check className="h-5 w-5 text-green-600" />
                )}
                {activeJob.status === 'failed' && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                
                <div>
                  <span className="font-medium">
                    {activeJob.invoice_type === 'purchase' ? 'Ulazne' : 'Izlazne'} fakture: 
                    {(activeJob.status === 'running' || activeJob.status === 'pending') && ' Preuzimanje u toku...'}
                    {(activeJob.status === 'completed' || activeJob.status === 'partial') && ` Završeno (${activeJob.invoices_saved} sačuvano)`}
                    {activeJob.status === 'failed' && ' Greška'}
                  </span>
                </div>
              </div>
              
              {/* Dismiss button for completed/failed */}
              {(activeJob.status === 'completed' || activeJob.status === 'failed' || activeJob.status === 'partial') && (
                <Button variant="ghost" size="sm" onClick={dismissJobStatus}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Progress bar only for running */}
            {(activeJob.status === 'running' || activeJob.status === 'pending') && (
              <>
                <Progress value={progress} className="my-2" />
                <div className="flex flex-wrap justify-between text-sm text-muted-foreground gap-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Mesec: {activeJob.current_month || 'Priprema...'}
                  </span>
                  <span>{activeJob.processed_months}/{activeJob.total_months} meseci</span>
                  <span>{activeJob.invoices_found} pronađeno</span>
                  <span>{activeJob.invoices_saved} sačuvano</span>
                </div>
              </>
            )}
            
            {/* Error message */}
            {activeJob.status === 'failed' && activeJob.error_message && (
              <p className="text-sm text-destructive mt-2">{activeJob.error_message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="purchase" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Ulazne fakture</span>
            <span className="sm:hidden">Ulazne</span>
            {filteredPurchaseInvoices.length > 0 && (
              <Badge variant="secondary" className="ml-1">{filteredPurchaseInvoices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Izlazne fakture</span>
            <span className="sm:hidden">Izlazne</span>
            {filteredSalesInvoices.length > 0 && (
              <Badge variant="secondary" className="ml-1">{filteredSalesInvoices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archive" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Arhiva</span>
            <span className="sm:hidden">Arhiva</span>
            {storedInvoices.length > 0 && (
              <Badge variant="secondary" className="ml-1">{storedInvoices.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Purchase Invoices Tab */}
        <TabsContent value="purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Ulazne fakture sa SEF-a
              </CardTitle>
              <CardDescription>
                Fakture koje ste primili od drugih firmi. Možete ih odobriti ili odbiti.
              </CardDescription>
            </CardHeader>
            <CardContent>

              {/* Date Range and Fetch */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                    className="w-full sm:w-40"
                  />
                  <span className="hidden sm:flex items-center text-muted-foreground">do</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateToChange(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                <Button onClick={handleFetchPurchase} disabled={isFetching || isEnriching || (activeJob?.status === 'running')}>
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Preuzmi sa SEF-a
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleStartLongSync('purchase')} 
                  disabled={isStarting || (activeJob?.status === 'running')}
                  title="Preuzmi sve fakture za poslednjih 3 godine"
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Preuzmi sve (3 god.)
                </Button>
                {incompleteCount > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={handleEnrichInvoices} 
                    disabled={isFetching || isEnriching}
                    title={`${incompleteCount} faktura bez podataka`}
                  >
                    {isEnriching ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Retry dopuna ({incompleteCount})
                  </Button>
                )}
              </div>

              {/* Invoice List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPurchaseInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nema ulaznih faktura{dateFrom || dateTo ? ' za izabrani period' : ''}</p>
                  <p className="text-sm">Kliknite "Preuzmi sa SEF-a" da preuzmete nove fakture</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Broj fakture</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Dobavljač</TableHead>
                          <TableHead className="text-right">Iznos</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Akcije</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPurchaseInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{invoice.counterparty_name}</div>
                                {invoice.counterparty_pib && (
                                  <div className="text-xs text-muted-foreground">PIB: {invoice.counterparty_pib}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(invoice.total_amount, invoice.currency)}
                            </TableCell>
                            <TableCell>{getStatusBadge(invoice.sef_status, invoice.local_status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handlePreview(invoice)}
                                  title="Pregled"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {invoice.local_status === 'pending' && invoice.sef_status !== 'Approved' && invoice.sef_status !== 'Rejected' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleApprove(invoice)}
                                      disabled={isProcessing}
                                      title="Odobri"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenReject(invoice.sef_invoice_id)}
                                      disabled={isProcessing}
                                      title="Odbij"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination for Purchase */}
                  {filteredPurchaseInvoices.length > 10 && (
                    <PaginationControls
                      page={purchasePage}
                      setPage={setPurchasePage}
                      perPage={purchasePerPage}
                      setPerPage={setPurchasePerPage}
                      totalItems={filteredPurchaseInvoices.length}
                      totalPages={totalPurchasePages}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Invoices Tab */}
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Izlazne fakture
              </CardTitle>
              <CardDescription>
                Fakture koje ste poslali drugim firmama putem SEF-a.
              </CardDescription>
            </CardHeader>
            <CardContent>

              {/* Date filter and Sync button */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                    className="w-full sm:w-40"
                  />
                  <span className="hidden sm:flex items-center text-muted-foreground">do</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateToChange(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => handleStartLongSync('sales')} 
                  disabled={isStarting || (activeJob?.status === 'running')}
                  title="Preuzmi sve izlazne fakture za poslednjih 3 godine"
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Preuzmi sve (3 god.)
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSalesInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nema izlaznih faktura{dateFrom || dateTo ? ' za izabrani period' : ''}</p>
                  <p className="text-sm">Fakture poslate na SEF će se automatski čuvati ovde, ili kliknite dugme iznad da preuzmete istoriju.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Broj fakture</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Kupac</TableHead>
                          <TableHead className="text-right">Iznos</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Akcije</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedSalesInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{invoice.counterparty_name}</div>
                                {invoice.counterparty_pib && (
                                  <div className="text-xs text-muted-foreground">PIB: {invoice.counterparty_pib}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(invoice.total_amount, invoice.currency)}
                            </TableCell>
                            <TableCell>{getStatusBadge(invoice.sef_status, invoice.local_status)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePreview(invoice)}
                                title="Pregled"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination for Sales */}
                  {filteredSalesInvoices.length > 10 && (
                    <PaginationControls
                      page={salesPage}
                      setPage={setSalesPage}
                      perPage={salesPerPage}
                      setPerPage={setSalesPerPage}
                      totalItems={filteredSalesInvoices.length}
                      totalPages={totalSalesPages}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Archive Tab */}
        <TabsContent value="archive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Arhiva SEF faktura
              </CardTitle>
              <CardDescription>
                Sve sačuvane fakture. SEF čuva fakture samo 30 dana - ovde su trajno sačuvane.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : storedInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Arhiva je prazna</p>
                  <p className="text-sm">Preuzmite fakture sa SEF-a ili uvezite XML/CSV</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tip</TableHead>
                        <TableHead>Broj fakture</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead className="text-right">Iznos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storedInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <Badge variant={invoice.invoice_type === 'purchase' ? 'outline' : 'default'}>
                              {invoice.invoice_type === 'purchase' ? 'Ulazna' : 'Izlazna'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium truncate max-w-[200px]">{invoice.counterparty_name}</div>
                              {invoice.counterparty_pib && (
                                <div className="text-xs text-muted-foreground">PIB: {invoice.counterparty_pib}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.total_amount, invoice.currency)}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.sef_status, invoice.local_status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePreview(invoice)}
                                title="Pregled"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteStoredInvoice(invoice.id)}
                                disabled={isDeleting}
                                title="Obriši"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pregled fakture: {previewInvoice?.invoice_number || previewInvoice?.sef_invoice_id}
            </DialogTitle>
            <DialogDescription>
              {previewInvoice?.counterparty_name} • {formatDate(previewInvoice?.issue_date || '')}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingXML ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : previewXML ? (
            <SEFInvoicePreview 
              xml={previewXML} 
              sefInvoiceId={previewInvoice?.sef_invoice_id}
              fetchedAt={previewInvoice?.fetched_at || undefined}
              invoiceNumber={previewInvoice?.invoice_number || undefined}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nema dostupnog XML sadržaja za ovu fakturu.
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odbij fakturu</DialogTitle>
            <DialogDescription>
              Unesite razlog odbijanja fakture. Ova informacija će biti poslata izdavaocu.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            placeholder="Razlog odbijanja..."
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={4}
          />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Otkaži
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectComment.trim() || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Odbij fakturu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uvoz faktura</DialogTitle>
            <DialogDescription>
              Uvezite istorijske fakture iz XML ili CSV fajla. Podržani su UBL XML fajlovi i SEF CSV eksporti.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Input
                type="file"
                accept=".xml,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {importFile ? importFile.name : 'Kliknite da izaberete fajl'}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  XML ili CSV format
                </span>
              </label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Otkaži
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importFile || isImporting}
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Uvezi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
