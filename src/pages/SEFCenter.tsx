import { useState, useMemo, useRef, useEffect } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertCircle, Check, X, Download, Upload, RefreshCw, Eye, FileText, Inbox, Send, Archive, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown, BookOpen, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
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

const formatShortDate = (dateString: string) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  } catch {
    return dateString;
  }
};

const getStatusBadge = (status: string, localStatus?: string) => {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' }> = {
    'New': { label: 'Nova', variant: 'default' },
    'Seen': { label: 'Viđena', variant: 'secondary' },
    'Approved': { label: 'Odobrena', variant: 'success' },
    'Rejected': { label: 'Odbijena', variant: 'destructive' },
    'Sent': { label: 'Poslata', variant: 'default' },
    'Cancelled': { label: 'Stornirana', variant: 'destructive' },
    'Storno': { label: 'Storno', variant: 'destructive' },
    'Imported': { label: 'Uvezeno', variant: 'outline' },
    'Unknown': { label: 'Nepoznato', variant: 'outline' },
  };

  const localStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' }> = {
    'pending': { label: 'Na čekanju', variant: 'secondary' },
    'approved': { label: 'Odobreno', variant: 'success' },
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
  const { fetchPurchaseInvoices, fetchSalesInvoices, acceptInvoice, rejectInvoice, cancelSalesInvoice, getInvoiceXML, enrichIncompleteInvoices, isFetching, isFetchingSales, isProcessing, isLoadingXML, isEnriching, isCancelling } = useSEFPurchaseInvoices();
  const { purchaseInvoices, salesInvoices, storedInvoices, isLoading, refetch, importFromXML, importFromCSV, deleteStoredInvoice, isDeleting, importToInvoices, bulkImportToInvoices, isImportingToInvoices, syncMissingKPOEntries, isSyncingKPO } = useSEFStorage(companyId);
  const { activeJob, isStarting, progress, startLongSync, dismissJobStatus, cancelJob } = useSEFLongSync(companyId);

  // Count incomplete invoices
  const incompleteCount = purchaseInvoices.filter(inv => !inv.invoice_number || !inv.counterparty_name || inv.total_amount === 0).length;
  const incompleteSalesCount = salesInvoices.filter(inv => !inv.invoice_number || !inv.counterparty_name || inv.total_amount === 0).length;
  const { getSEFStatus } = useSEF();

  // State
  const [activeTab, setActiveTab] = useState('purchase');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Date picker popover state (controlled)
  const [purchaseDateFromOpen, setPurchaseDateFromOpen] = useState(false);
  const [purchaseDateToOpen, setPurchaseDateToOpen] = useState(false);
  const [salesDateFromOpen, setSalesDateFromOpen] = useState(false);
  const [salesDateToOpen, setSalesDateToOpen] = useState(false);
  
  // Date picker epoch za forsiranje remount-a (čisti orphaned Radix portale)
  const [datePickerEpoch, setDatePickerEpoch] = useState(0);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination state
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePerPage, setPurchasePerPage] = useState(20);
  const [salesPage, setSalesPage] = useState(1);
  const [salesPerPage, setSalesPerPage] = useState(20);
  
  // Sorting state
  type SortField = 'date' | 'amount' | 'status' | null;
  type SortDirection = 'asc' | 'desc';
  const [purchaseSort, setPurchaseSort] = useState<{ field: SortField; direction: SortDirection }>({ field: null, direction: 'desc' });
  const [salesSort, setSalesSort] = useState<{ field: SortField; direction: SortDirection }>({ field: null, direction: 'desc' });
  const [archiveSort, setArchiveSort] = useState<{ field: SortField; direction: SortDirection }>({ field: null, direction: 'desc' });
  
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
  
  // Storno dialog state
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoInvoice, setStornoInvoice] = useState<StoredSEFInvoice | null>(null);
  const [stornoComment, setStornoComment] = useState('');
  
  // Ref za SINHRONÚ blokadu date picker-a (rešava race condition sa state-om)
  const blockDatePickersRef = useRef(false);

  // Ukloni/sakrij bilo koji DayPicker/Popover portal koji se "zaglavi" u DOM-u
  const cleanupRogueCalendars = () => {
    // 1) Ukloni sve Radix popper wrapper-e koji sadrže DayPicker (.rdp)
    const popperWrappers = Array.from(
      document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper]'),
    );
    popperWrappers.forEach((wrapper) => {
      if (wrapper.querySelector('.rdp')) {
        wrapper.remove();
      }
    });

    // 2) Fallback: ako je .rdp renderovan direktno (ili u drugim portalima), ukloni najbliži portal
    const dayPickers = Array.from(document.querySelectorAll<HTMLElement>('.rdp'));
    dayPickers.forEach((rdp) => {
      const host =
        rdp.closest<HTMLElement>('[data-radix-popper-content-wrapper]') ||
        rdp.closest<HTMLElement>('[data-radix-portal]') ||
        rdp.closest<HTMLElement>('div[id^="radix-"]');

      if (host) {
        host.remove();
      } else {
        // poslednja linija odbrane
        rdp.style.display = 'none';
        rdp.style.visibility = 'hidden';
        rdp.style.pointerEvents = 'none';
      }
    });
  };
  
  // Helper to close all date pickers AND clean up orphaned Radix portals
  const closeAllDatePickers = () => {
    // ODMAH postavi blokadu (sinhrono, bez čekanja na re-render)
    blockDatePickersRef.current = true;
    
    // Blur fokusiran element da se prekine Radix focus lock
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setPurchaseDateFromOpen(false);
    setPurchaseDateToOpen(false);
    setSalesDateFromOpen(false);
    setSalesDateToOpen(false);

    // AGRESIVNO čišćenje: ukloni bilo koji kalendar portal koji je ostao
    cleanupRogueCalendars();
    
    // Povećaj epoch da forsiraš remount date picker sekcija (čisti orphaned portale)
    setDatePickerEpoch(prev => prev + 1);
    
    // Reset blokade nakon kratkog delay-a (500ms je dovoljno za Radix event propagaciju)
    setTimeout(() => {
      blockDatePickersRef.current = false;
    }, 500);
  };

  // Detekcija aktivnog sync-a (za kondicionalno renderovanje)
  const isSyncActive = isStarting || 
    activeJob?.status === 'pending' || 
    activeJob?.status === 'running' || 
    activeJob?.status === 'partial';

  // Zaštitni handler koji sprečava neželjeno otvaranje tokom sync-a
  const handleDatePickerOpenChange = (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    newOpen: boolean
  ) => {
    // Blokiraj otvaranje ako je REF aktivan ILI sync aktivan (uključujući 'pending')
    if (newOpen && (
      blockDatePickersRef.current ||
      isSyncActive
    )) {
      return;
    }
    setter(newOpen);
  };

  // Force close all date pickers when sync becomes active
  useEffect(() => {
    if (isSyncActive) {
      closeAllDatePickers();
    }
  }, [isSyncActive]);

  // Kill-switch tokom sync-a: spreči da se bilo koji kalendar portal uopšte pojavi u DOM-u
  useEffect(() => {
    if (!isSyncActive) {
      document.body.removeAttribute('data-sef-sync-active');
      return;
    }

    document.body.setAttribute('data-sef-sync-active', '1');
    cleanupRogueCalendars();

    const observer = new MutationObserver(() => {
      cleanupRogueCalendars();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Safety sweeps (neki portali se pojave nakon animacija)
    const t1 = window.setTimeout(() => cleanupRogueCalendars(), 200);
    const t2 = window.setTimeout(() => cleanupRogueCalendars(), 1000);

    return () => {
      observer.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      document.body.removeAttribute('data-sef-sync-active');
    };
  }, [isSyncActive]);

  // Helper function for sorting
  const sortInvoices = (invoices: StoredSEFInvoice[], sort: { field: SortField; direction: SortDirection }) => {
    if (!sort.field) return invoices;
    
    return [...invoices].sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'date':
          const dateA = a.issue_date || '';
          const dateB = b.issue_date || '';
          comparison = dateA.localeCompare(dateB);
          break;
        case 'amount':
          comparison = (a.total_amount || 0) - (b.total_amount || 0);
          break;
        case 'status':
          const statusA = a.sef_status || '';
          const statusB = b.sef_status || '';
          comparison = statusA.localeCompare(statusB);
          break;
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  };

  // Filtered invoices by date range AND search query
  const filteredPurchaseInvoices = useMemo(() => {
    const filtered = purchaseInvoices.filter(inv => {
      const issueDate = inv.issue_date;
      if (!issueDate) return true;
      if (dateFrom && issueDate < dateFrom) return false;
      if (dateTo && issueDate > dateTo) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = inv.invoice_number?.toLowerCase().includes(query);
        const matchesPartner = inv.counterparty_name?.toLowerCase().includes(query);
        const matchesPib = inv.counterparty_pib?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesPartner && !matchesPib) return false;
      }
      
      return true;
    });
    
    return sortInvoices(filtered, purchaseSort);
  }, [purchaseInvoices, dateFrom, dateTo, searchQuery, purchaseSort]);

  const filteredSalesInvoices = useMemo(() => {
    const filtered = salesInvoices.filter(inv => {
      const issueDate = inv.issue_date;
      if (!issueDate) return true;
      if (dateFrom && issueDate < dateFrom) return false;
      if (dateTo && issueDate > dateTo) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = inv.invoice_number?.toLowerCase().includes(query);
        const matchesPartner = inv.counterparty_name?.toLowerCase().includes(query);
        const matchesPib = inv.counterparty_pib?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesPartner && !matchesPib) return false;
      }
      
      return true;
    });
    
    return sortInvoices(filtered, salesSort);
  }, [salesInvoices, dateFrom, dateTo, searchQuery, salesSort]);

  // Sorted archive invoices
  const sortedStoredInvoices = useMemo(() => {
    return sortInvoices(storedInvoices, archiveSort);
  }, [storedInvoices, archiveSort]);

  // Importable sales invoices (not storno/cancelled and not already imported)
  const importableSalesInvoices = useMemo(() => {
    return salesInvoices.filter(inv => {
      const status = inv.sef_status.toLowerCase();
      const isStorno = status === 'cancelled' || status === 'storno' || status === 'stornirano';
      const isImported = inv.local_status === 'imported' || inv.linked_invoice_id;
      return !isStorno && !isImported;
    });
  }, [salesInvoices]);

  // Search suggestions from all invoices
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 1) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions: Array<{
      type: 'purchase' | 'sales';
      invoiceNumber: string | null;
      counterpartyName: string | null;
      label: string;
    }> = [];
    
    // From purchase invoices
    purchaseInvoices.forEach(inv => {
      if (
        inv.invoice_number?.toLowerCase().includes(query) ||
        inv.counterparty_name?.toLowerCase().includes(query) ||
        inv.counterparty_pib?.toLowerCase().includes(query)
      ) {
        suggestions.push({
          type: 'purchase',
          invoiceNumber: inv.invoice_number,
          counterpartyName: inv.counterparty_name,
          label: `${inv.invoice_number || 'Bez broja'} - ${inv.counterparty_name || 'Nepoznat'}`,
        });
      }
    });
    
    // From sales invoices
    salesInvoices.forEach(inv => {
      if (
        inv.invoice_number?.toLowerCase().includes(query) ||
        inv.counterparty_name?.toLowerCase().includes(query) ||
        inv.counterparty_pib?.toLowerCase().includes(query)
      ) {
        suggestions.push({
          type: 'sales',
          invoiceNumber: inv.invoice_number,
          counterpartyName: inv.counterparty_name,
          label: `${inv.invoice_number || 'Bez broja'} - ${inv.counterparty_name || 'Nepoznat'}`,
        });
      }
    });
    
    // Deduplicate by label and limit to 10
    const unique = [...new Map(suggestions.map(s => [s.label, s])).values()];
    return unique.slice(0, 10);
  }, [purchaseInvoices, salesInvoices, searchQuery]);

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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPurchasePage(1);
    setSalesPage(1);
  };

  // Toggle sort handler
  const toggleSort = (
    currentSort: { field: SortField; direction: SortDirection },
    setSort: React.Dispatch<React.SetStateAction<{ field: SortField; direction: SortDirection }>>,
    field: SortField
  ) => {
    if (currentSort.field === field) {
      // Toggle direction or clear
      if (currentSort.direction === 'desc') {
        setSort({ field, direction: 'asc' });
      } else {
        setSort({ field: null, direction: 'desc' });
      }
    } else {
      // New field, start with desc
      setSort({ field, direction: 'desc' });
    }
  };

  // Sortable column header component
  const SortableHeader = ({ 
    field, 
    currentSort, 
    setSort, 
    children, 
    className = '' 
  }: { 
    field: SortField; 
    currentSort: { field: SortField; direction: SortDirection }; 
    setSort: React.Dispatch<React.SetStateAction<{ field: SortField; direction: SortDirection }>>; 
    children: React.ReactNode; 
    className?: string;
  }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
      onClick={() => toggleSort(currentSort, setSort, field)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {children}
        {currentSort.field === field ? (
          currentSort.direction === 'desc' ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  const handleSelectSuggestion = (suggestion: { label: string; type: 'purchase' | 'sales' }) => {
    setSearchQuery(suggestion.label.split(' - ')[0]); // Use invoice number part
    setSearchOpen(false);
    setPurchasePage(1);
    setSalesPage(1);
    // Switch to appropriate tab
    setActiveTab(suggestion.type);
  };

  const clearSearch = () => {
    setSearchQuery('');
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

  const handleFetchSales = async () => {
    if (!companyId) return;
    const result = await fetchSalesInvoices(companyId, dateFrom, dateTo);
    if (result.success) {
      setTimeout(() => refetch(), 500);
    }
  };

  const handleStartLongSync = async (invoiceType: 'purchase' | 'sales') => {
    if (!companyId) return;
    
    // Zatvori sve date pickere i postavi blokadu ODMAH
    closeAllDatePickers();
    
    // Duža pauza da se DOM stabilizuje, Radix eventi propagiraju i portali očiste
    await new Promise(resolve => setTimeout(resolve, 200));
    
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

  const handleFetchSalesInvoices = async () => {
    if (!companyId) return;
    await fetchSalesInvoices(companyId, dateFrom, dateTo);
    setTimeout(() => refetch(), 500);
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

  const handleOpenStorno = (invoice: StoredSEFInvoice) => {
    setStornoInvoice(invoice);
    setStornoComment('');
    setStornoOpen(true);
  };

  const handleStorno = async () => {
    if (!companyId || !stornoInvoice) return;
    
    // Determine action based on status
    const action = stornoInvoice.sef_status === 'Sent' || stornoInvoice.sef_status === 'Approved' || stornoInvoice.sef_status === 'Seen'
      ? 'storno' 
      : 'cancel';
    
    const result = await cancelSalesInvoice(companyId, stornoInvoice.sef_invoice_id, action, stornoComment);
    
    if (result.success) {
      setStornoOpen(false);
      setStornoInvoice(null);
      refetch();
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

  if (!selectedCompany.has_sef_api_key) {
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
          activeJob.status === 'running' || activeJob.status === 'pending' || activeJob.status === 'partial'
            ? "border-primary/20 bg-primary/5"
            : activeJob.status === 'completed'
            ? "border-green-500/20 bg-green-500/5"
            : "border-destructive/20 bg-destructive/5"
        }>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(activeJob.status === 'running' || activeJob.status === 'pending' || activeJob.status === 'partial') && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {activeJob.status === 'completed' && (
                  <Check className="h-5 w-5 text-green-600" />
                )}
                {activeJob.status === 'failed' && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                
                <div>
                  <span className="font-medium">
                    {activeJob.invoice_type === 'purchase' ? 'Ulazne' : 'Izlazne'} fakture: 
                    {(activeJob.status === 'running' || activeJob.status === 'pending') && ' Preuzimanje u toku...'}
                    {activeJob.status === 'partial' && ' Nastavljamo automatski...'}
                    {activeJob.status === 'completed' && ` Završeno (${activeJob.invoices_saved} sačuvano)`}
                    {activeJob.status === 'failed' && ' Greška'}
                  </span>
                </div>
              </div>
              
              {/* Cancel button for running/partial jobs */}
              {(activeJob.status === 'running' || activeJob.status === 'pending' || activeJob.status === 'partial') && (
                <Button variant="ghost" size="sm" onClick={cancelJob} className="text-destructive hover:text-destructive">
                  <X className="h-4 w-4 mr-1" />
                  Prekini
                </Button>
              )}
              
              {/* Dismiss button for completed/failed ONLY */}
              {(activeJob.status === 'completed' || activeJob.status === 'failed') && (
                <Button variant="ghost" size="sm" onClick={dismissJobStatus}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Progress bar for running AND partial */}
            {(activeJob.status === 'running' || activeJob.status === 'pending' || activeJob.status === 'partial') && (
              <>
                <Progress value={progress} className="my-2" />
                <div className="flex flex-wrap justify-between text-sm text-muted-foreground gap-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {activeJob.status === 'partial' 
                      ? 'Čeka nastavak...' 
                      : `Mesec: ${activeJob.current_month || 'Priprema...'}`}
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

              {/* Date Range, Search, and Buttons - all inline on desktop */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:flex-wrap gap-4 mb-6">
              {/* Date Range - first on desktop */}
                <div key={`purchase-datepickers-${datePickerEpoch}`} className="flex flex-col sm:flex-row items-center gap-1 order-2 lg:order-1">
                  {/* Tokom sync-a renderuj samo disabled dugmad BEZ Popover-a */}
                  {isSyncActive ? (
                    <>
                      <Button type="button" variant="outline" disabled className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm opacity-50">
                        {dateFrom ? formatShortDate(dateFrom) : "Od"}
                        <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                      </Button>
                      <span className="hidden sm:flex items-center text-muted-foreground text-sm px-1">do</span>
                      <Button type="button" variant="outline" disabled className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm opacity-50">
                        {dateTo ? formatShortDate(dateTo) : "Do"}
                        <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Popover 
                        open={purchaseDateFromOpen} 
                        onOpenChange={(open) => handleDatePickerOpenChange(setPurchaseDateFromOpen, open)}
                        modal={true}
                      >
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm">
                            {dateFrom ? formatShortDate(dateFrom) : "Od"}
                            <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999]" align="start" side="bottom" sideOffset={8} collisionPadding={{ top: 80 }}>
                          <Calendar
                            mode="single"
                            selected={dateFrom ? new Date(dateFrom) : undefined}
                            onSelect={(date) => {
                              handleDateFromChange(date ? format(date, 'yyyy-MM-dd') : '');
                              setPurchaseDateFromOpen(false);
                            }}
                            initialFocus={!isSyncActive}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="hidden sm:flex items-center text-muted-foreground text-sm px-1">do</span>
                      <Popover 
                        open={purchaseDateToOpen} 
                        onOpenChange={(open) => handleDatePickerOpenChange(setPurchaseDateToOpen, open)}
                        modal={true}
                      >
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm">
                            {dateTo ? formatShortDate(dateTo) : "Do"}
                            <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999]" align="start" side="bottom" sideOffset={8} collisionPadding={{ top: 80 }}>
                          <Calendar
                            mode="single"
                            selected={dateTo ? new Date(dateTo) : undefined}
                            onSelect={(date) => {
                              handleDateToChange(date ? format(date, 'yyyy-MM-dd') : '');
                              setPurchaseDateToOpen(false);
                            }}
                            initialFocus={!isSyncActive}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
                
                {/* Search with autocomplete - before dates on mobile, after on desktop */}
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative order-1 lg:order-2 lg:flex-1 lg:max-w-xs">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Pretraži po broju ili partneru..."
                        value={searchQuery}
                        onChange={(e) => {
                          handleSearchChange(e.target.value);
                          if (e.target.value.length >= 1) {
                            setSearchOpen(true);
                          }
                        }}
                        onFocus={() => {
                          if (searchQuery.length >= 1) {
                            setSearchOpen(true);
                          }
                        }}
                        className="pl-10 pr-10"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          onClick={clearSearch}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[var(--radix-popover-trigger-width)] p-0" 
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <CommandList>
                        {searchSuggestions.length === 0 ? (
                          <CommandEmpty>Nema rezultata za "{searchQuery}"</CommandEmpty>
                        ) : (
                          <>
                            {searchSuggestions.filter(s => s.type === 'purchase').length > 0 && (
                              <CommandGroup heading="Ulazne fakture">
                                {searchSuggestions.filter(s => s.type === 'purchase').map((suggestion, idx) => (
                                  <CommandItem
                                    key={`purchase-${idx}`}
                                    value={suggestion.label}
                                    onSelect={() => handleSelectSuggestion(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <Inbox className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>{suggestion.label}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                            {searchSuggestions.filter(s => s.type === 'sales').length > 0 && (
                              <CommandGroup heading="Izlazne fakture">
                                {searchSuggestions.filter(s => s.type === 'sales').map((suggestion, idx) => (
                                  <CommandItem
                                    key={`sales-${idx}`}
                                    value={suggestion.label}
                                    onSelect={() => handleSelectSuggestion(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <Send className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>{suggestion.label}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Buttons - pushed to right on desktop */}
                <div className="flex flex-wrap gap-2 order-3 lg:ml-auto">
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
                      Osveži
                    </Button>
                  )}
                </div>
              </div>

              {/* Invoice List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPurchaseInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nema ulaznih faktura{searchQuery ? ` za "${searchQuery}"` : (dateFrom || dateTo ? ' za izabrani period' : '')}</p>
                  <p className="text-sm">
                    {searchQuery ? 'Pokušajte drugu pretragu' : 'Kliknite "Preuzmi sa SEF-a" da preuzmete nove fakture'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Broj fakture</TableHead>
                          <SortableHeader field="date" currentSort={purchaseSort} setSort={setPurchaseSort}>
                            Datum
                          </SortableHeader>
                          <TableHead>Dobavljač</TableHead>
                          <SortableHeader field="amount" currentSort={purchaseSort} setSort={setPurchaseSort} className="text-right">
                            Iznos
                          </SortableHeader>
                          <SortableHeader field="status" currentSort={purchaseSort} setSort={setPurchaseSort}>
                            Status
                          </SortableHeader>
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

              {/* Date Range, Search, and Buttons - all inline on desktop */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:flex-wrap gap-4 mb-6">
              {/* Date Range - first on desktop */}
                <div key={`sales-datepickers-${datePickerEpoch}`} className="flex flex-col sm:flex-row items-center gap-1 order-2 lg:order-1">
                  {/* Tokom sync-a renderuj samo disabled dugmad BEZ Popover-a */}
                  {isSyncActive ? (
                    <>
                      <Button type="button" variant="outline" disabled className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm opacity-50">
                        {dateFrom ? formatShortDate(dateFrom) : "Od"}
                        <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                      </Button>
                      <span className="hidden sm:flex items-center text-muted-foreground text-sm px-1">do</span>
                      <Button type="button" variant="outline" disabled className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm opacity-50">
                        {dateTo ? formatShortDate(dateTo) : "Do"}
                        <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Popover 
                        open={salesDateFromOpen}
                        onOpenChange={(open) => handleDatePickerOpenChange(setSalesDateFromOpen, open)}
                        modal={true}
                      >
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm">
                            {dateFrom ? formatShortDate(dateFrom) : "Od"}
                            <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999]" align="start" side="bottom" sideOffset={8} collisionPadding={{ top: 80 }}>
                          <Calendar
                            mode="single"
                            selected={dateFrom ? new Date(dateFrom) : undefined}
                            onSelect={(date) => {
                              handleDateFromChange(date ? format(date, 'yyyy-MM-dd') : '');
                              setSalesDateFromOpen(false);
                            }}
                            initialFocus={!isSyncActive}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="hidden sm:flex items-center text-muted-foreground text-sm px-1">do</span>
                      <Popover 
                        open={salesDateToOpen} 
                        onOpenChange={(open) => handleDatePickerOpenChange(setSalesDateToOpen, open)}
                        modal={true}
                      >
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full sm:w-28 justify-between text-left font-normal h-9 text-sm">
                            {dateTo ? formatShortDate(dateTo) : "Do"}
                            <CalendarIcon className="ml-1 h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[9999]" align="start" side="bottom" sideOffset={8} collisionPadding={{ top: 80 }}>
                          <Calendar
                            mode="single"
                            selected={dateTo ? new Date(dateTo) : undefined}
                            onSelect={(date) => {
                              handleDateToChange(date ? format(date, 'yyyy-MM-dd') : '');
                              setSalesDateToOpen(false);
                            }}
                            initialFocus={!isSyncActive}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
                
                {/* Search with autocomplete - before dates on mobile, after on desktop */}
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative order-1 lg:order-2 lg:flex-1 lg:max-w-xs">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pretraži po broju ili partneru..."
                        value={searchQuery}
                        onChange={(e) => {
                          handleSearchChange(e.target.value);
                          if (e.target.value.length >= 1) {
                            setSearchOpen(true);
                          }
                        }}
                        onFocus={() => {
                          if (searchQuery.length >= 1) {
                            setSearchOpen(true);
                          }
                        }}
                        className="pl-10 pr-10"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          onClick={clearSearch}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[var(--radix-popover-trigger-width)] p-0" 
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <CommandList>
                        {searchSuggestions.length === 0 ? (
                          <CommandEmpty>Nema rezultata za "{searchQuery}"</CommandEmpty>
                        ) : (
                          <>
                            {searchSuggestions.filter(s => s.type === 'purchase').length > 0 && (
                              <CommandGroup heading="Ulazne fakture">
                                {searchSuggestions.filter(s => s.type === 'purchase').map((suggestion, idx) => (
                                  <CommandItem
                                    key={`purchase-${idx}`}
                                    value={suggestion.label}
                                    onSelect={() => handleSelectSuggestion(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <Inbox className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>{suggestion.label}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                            {searchSuggestions.filter(s => s.type === 'sales').length > 0 && (
                              <CommandGroup heading="Izlazne fakture">
                                {searchSuggestions.filter(s => s.type === 'sales').map((suggestion, idx) => (
                                  <CommandItem
                                    key={`sales-${idx}`}
                                    value={suggestion.label}
                                    onSelect={() => handleSelectSuggestion(suggestion)}
                                    className="cursor-pointer"
                                  >
                                    <Send className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>{suggestion.label}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Buttons - pushed to right on desktop */}
                <div className="flex flex-wrap gap-2 order-3 lg:ml-auto">
                  <Button 
                    variant="outline" 
                    onClick={handleFetchSales} 
                    disabled={isFetchingSales}
                    title="Preuzmi izlazne fakture za izabrani period"
                  >
                    {isFetchingSales ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Preuzmi sa SEF-a
                  </Button>
                  
                  {/* Dropdown for other actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" title="Više opcija">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleStartLongSync('sales')}
                        disabled={isStarting || (activeJob?.status === 'running')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Preuzmi sve (3 god.)
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={handleFetchSalesInvoices} 
                        disabled={isFetchingSales}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Osveži statuse
                      </DropdownMenuItem>
                      {incompleteSalesCount > 0 && (
                        <DropdownMenuItem 
                          onClick={() => companyId && enrichIncompleteInvoices(companyId).then(() => setTimeout(() => refetch(), 500))}
                          disabled={isFetching || isEnriching}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Osveži podatke ({incompleteSalesCount})
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => syncMissingKPOEntries()}
                        disabled={isSyncingKPO}
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        Sinhronizuj postojeće u KPO
                      </DropdownMenuItem>
                      {importableSalesInvoices.length > 0 && (
                        <DropdownMenuItem 
                          onClick={() => bulkImportToInvoices(importableSalesInvoices)}
                          disabled={isImportingToInvoices}
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          Uveži sve u KPO ({importableSalesInvoices.length})
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSalesInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nema izlaznih faktura{searchQuery ? ` za "${searchQuery}"` : (dateFrom || dateTo ? ' za izabrani period' : '')}</p>
                  <p className="text-sm">
                    {searchQuery ? 'Pokušajte drugu pretragu' : 'Fakture poslate na SEF će se automatski čuvati ovde, ili kliknite dugme iznad da preuzmete istoriju.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Broj fakture</TableHead>
                          <SortableHeader field="date" currentSort={salesSort} setSort={setSalesSort}>
                            Datum
                          </SortableHeader>
                          <TableHead>Kupac</TableHead>
                          <SortableHeader field="amount" currentSort={salesSort} setSort={setSalesSort} className="text-right">
                            Iznos
                          </SortableHeader>
                          <SortableHeader field="status" currentSort={salesSort} setSort={setSalesSort}>
                            Status
                          </SortableHeader>
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
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handlePreview(invoice)}
                                  title="Pregled"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {/* Import to KPO button - show for non-storno invoices that aren't imported */}
                                {invoice.sef_status !== 'Cancelled' && 
                                 invoice.sef_status !== 'Storno' && 
                                 invoice.sef_status !== 'Stornirano' &&
                                 invoice.local_status !== 'imported' && 
                                 !invoice.linked_invoice_id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => importToInvoices(invoice)}
                                    disabled={isImportingToInvoices}
                                    title="Uveži u KPO knjigu"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                  </Button>
                                )}
                                {invoice.sef_status !== 'Cancelled' && invoice.sef_status !== 'Storno' && invoice.sef_status !== 'Rejected' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenStorno(invoice)}
                                    disabled={isCancelling}
                                    title="Storniraj fakturu"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
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
                        <SortableHeader field="date" currentSort={archiveSort} setSort={setArchiveSort}>
                          Datum
                        </SortableHeader>
                        <TableHead>Partner</TableHead>
                        <SortableHeader field="amount" currentSort={archiveSort} setSort={setArchiveSort} className="text-right">
                          Iznos
                        </SortableHeader>
                        <SortableHeader field="status" currentSort={archiveSort} setSort={setArchiveSort}>
                          Status
                        </SortableHeader>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedStoredInvoices.map((invoice) => (
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

      {/* Storno Dialog */}
      <Dialog open={stornoOpen} onOpenChange={setStornoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storniraj fakturu</DialogTitle>
            <DialogDescription>
              Da li ste sigurni da želite da stornirate fakturu {stornoInvoice?.invoice_number}? Ova akcija se ne može poništiti.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Razlog storniranja (opciono)</label>
              <Textarea
                placeholder="Unesite razlog storniranja..."
                value={stornoComment}
                onChange={(e) => setStornoComment(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setStornoOpen(false)}>
              Otkaži
            </Button>
            <Button 
              variant="destructive"
              onClick={handleStorno}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Storniraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
