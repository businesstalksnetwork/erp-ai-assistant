import { useState, useRef, useMemo } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useReminders, Reminder } from '@/hooks/useReminders';
import { startOfDay, endOfMonth, endOfYear, addMonths, isBefore, isAfter } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

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
import { Bell, Plus, Pencil, Trash2, Loader2, Building2, Calendar, QrCode, FileText, Repeat, Download, MoreVertical, AlertTriangle, CalendarDays, CalendarRange } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import PausalniPdfDialog, { PausalniType } from '@/components/PausalniPdfDialog';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Generate IPS QR code string for Serbian payments (NBS standard)
// Format: https://ips.nbs.rs/PDF/Tehnicki_standard_IPS_QR_koda.pdf
function generateIPSQRCode(
  receiverName: string,
  receiverAccount: string,
  amount: number,
  paymentPurpose: string,
  payerName: string,
  payerAddress?: string | null,
  paymentCode: string = '289',
  paymentModel: string = '97',
  paymentReference: string = ''
): string {
  // Receiver account: format XXX-XXXXXXXXXXXXX-XX (18 digits total)
  // The middle part should be padded with zeros to 13 digits
  const accountParts = receiverAccount.split('-');
  let formattedAccount: string;
  
  if (accountParts.length === 3) {
    // Format: bank (3) - account (13, pad with zeros at start) - control (2)
    const bank = accountParts[0].replace(/\D/g, '').padStart(3, '0').substring(0, 3);
    const account = accountParts[1].replace(/\D/g, '').padStart(13, '0').substring(0, 13);
    const control = accountParts[2].replace(/\D/g, '').padStart(2, '0').substring(0, 2);
    formattedAccount = bank + account + control;
  } else {
    // Fallback: just remove non-digits and pad to 18
    formattedAccount = receiverAccount.replace(/\D/g, '').padStart(18, '0').substring(0, 18);
  }

  // Amount: NBS IPS uses format "RSD1234,56" (comma as decimal separator, no spaces)
  const formattedAmount = amount.toFixed(2).replace('.', ',');

  // Receiver name (max 70 chars)
  const n = receiverName.trim().substring(0, 70);
  
  // Payer info - join name and address with newline
  const p = [payerName?.trim(), payerAddress?.trim()].filter(Boolean).join('\n');

  // Payment purpose (max 35 chars)
  const purpose = paymentPurpose.trim().substring(0, 35);
  
  // Payment code (šifra plaćanja) - must be 3 digits
  const sf = paymentCode.trim().padStart(3, '0').substring(0, 3);

  // Reference (poziv na broj) - model + reference number, no separator
  const ref = paymentReference.trim();
  const model = paymentModel.trim();
  
  // Build IPS QR code string with | as separator (per NBS standard)
  const parts = [
    'K:PR',           // Identifier: PR = payment request
    'V:01',           // Version: 01
    'C:1',            // Character set: 1 = UTF-8
    `R:${formattedAccount}`,  // Receiver account (18 digits)
    `N:${n}`,         // Receiver name
    `I:RSD${formattedAmount}`, // Amount with currency
    `P:${p}`,         // Payer info
    `SF:${sf}`,       // Payment code
    `S:${purpose}`,   // Purpose
  ];
  
  // Add reference only if both model and reference are provided
  if (model && ref) {
    parts.push(`RO:${model}${ref}`);
  }

  return parts.join('|');
}

export default function Reminders() {
  const { selectedCompany } = useSelectedCompany();
  const { reminders, isLoading, createReminder, updateReminder, deleteReminder, toggleComplete, uploadAttachment, getSignedUrl } = useReminders(selectedCompany?.id || null);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Paušalni PDF dialog state
  const [pausalniDialogOpen, setPausalniDialogOpen] = useState(false);
  const [pausalniType, setPausalniType] = useState<PausalniType>('porez');
  const [isCreatingBulk, setIsCreatingBulk] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    due_date: '',
    reminder_date: '',
    recurrence_type: 'none' as 'none' | 'monthly' | 'quarterly' | 'yearly',
    recurrence_day: '',
    attachment_url: '',
    recipient_name: '',
    recipient_account: '',
    payment_model: '97',
    payment_reference: '',
    payment_code: '289',
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      amount: '',
      due_date: '',
      reminder_date: '',
      recurrence_type: 'none',
      recurrence_day: '',
      attachment_url: '',
      recipient_name: '',
      recipient_account: '',
      payment_model: '97',
      payment_reference: '',
      payment_code: '289',
    });
    setEditId(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (reminder: Reminder) => {
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      amount: reminder.amount?.toString() || '',
      due_date: reminder.due_date,
      reminder_date: reminder.reminder_date || '',
      recurrence_type: reminder.recurrence_type || 'none',
      recurrence_day: reminder.recurrence_day?.toString() || '',
      attachment_url: reminder.attachment_url || '',
      recipient_name: reminder.recipient_name || '',
      recipient_account: reminder.recipient_account || '',
      payment_model: reminder.payment_model || '97',
      payment_reference: reminder.payment_reference || '',
      payment_code: reminder.payment_code || '289',
    });
    setEditId(reminder.id);
    setIsOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany) return;

    if (file.type !== 'application/pdf') {
      alert('Samo PDF fajlovi su dozvoljeni');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadAttachment(selectedCompany.id, file);
      setFormData(prev => ({ ...prev, attachment_url: url }));
    } catch (error) {
      console.error('Upload error:', error);
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const data = {
      title: formData.title,
      description: formData.description || null,
      amount: formData.amount ? parseFloat(formData.amount) : null,
      due_date: formData.due_date,
      reminder_date: formData.reminder_date || null,
      company_id: selectedCompany.id,
      is_completed: false,
      recurrence_type: formData.recurrence_type,
      recurrence_day: formData.recurrence_type !== 'none' && formData.recurrence_day 
        ? parseInt(formData.recurrence_day) 
        : null,
      attachment_url: formData.attachment_url || null,
      recipient_name: formData.recipient_name || null,
      recipient_account: formData.recipient_account || null,
      payment_model: formData.payment_model || '97',
      payment_reference: formData.payment_reference || null,
      payment_code: formData.payment_code || '289',
    };

    if (editId) {
      await updateReminder.mutateAsync({ id: editId, ...data });
    } else {
      await createReminder.mutateAsync(data);
    }
    handleOpenChange(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteReminder.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    await toggleComplete.mutateAsync({ id, is_completed: !currentState });
  };

  const handleShowQR = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setQrDialogOpen(true);
  };

  const handleViewAttachment = async (reminder: Reminder) => {
    if (!reminder.attachment_url) return;
    const signedUrl = await getSignedUrl(reminder.attachment_url);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  const completedReminders = reminders.filter(r => r.is_completed);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Categorize active reminders
  const today = startOfDay(new Date());
  const currentMonthEnd = endOfMonth(today);
  const threeMonthsLater = endOfMonth(addMonths(today, 3));
  const yearEnd = endOfYear(today);

  const categorizedReminders = useMemo(() => {
    const activeReminders = reminders.filter(r => !r.is_completed);
    
    const overdue = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return isBefore(dueDate, today);
    }).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

    const currentMonth = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return !isBefore(dueDate, today) && !isAfter(dueDate, currentMonthEnd);
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const nextThreeMonths = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return isAfter(dueDate, currentMonthEnd) && !isAfter(dueDate, threeMonthsLater);
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const untilEndOfYear = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return isAfter(dueDate, threeMonthsLater) && !isAfter(dueDate, yearEnd);
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    return { overdue, currentMonth, nextThreeMonths, untilEndOfYear };
  }, [reminders, today, currentMonthEnd, threeMonthsLater, yearEnd]);

  const allActiveReminders = [
    ...categorizedReminders.overdue,
    ...categorizedReminders.currentMonth,
    ...categorizedReminders.nextThreeMonths,
    ...categorizedReminders.untilEndOfYear,
  ];

  // Pagination calculations
  const totalActiveReminders = allActiveReminders.length;
  const totalPages = Math.ceil(totalActiveReminders / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Get paginated items for each category
  const getPaginatedCategory = (category: Reminder[], categoryStartIndex: number) => {
    const categoryEndIndex = categoryStartIndex + category.length;
    if (categoryEndIndex <= startIndex || categoryStartIndex >= endIndex) {
      return { items: [] as Reminder[], nextStartIndex: categoryEndIndex };
    }
    const sliceStart = Math.max(0, startIndex - categoryStartIndex);
    const sliceEnd = Math.min(category.length, endIndex - categoryStartIndex);
    return { items: category.slice(sliceStart, sliceEnd), nextStartIndex: categoryEndIndex };
  };

  let runningIndex = 0;
  const paginatedOverdue = getPaginatedCategory(categorizedReminders.overdue, runningIndex);
  runningIndex = paginatedOverdue.nextStartIndex;
  const paginatedCurrentMonth = getPaginatedCategory(categorizedReminders.currentMonth, runningIndex);
  runningIndex = paginatedCurrentMonth.nextStartIndex;
  const paginatedNextThreeMonths = getPaginatedCategory(categorizedReminders.nextThreeMonths, runningIndex);
  runningIndex = paginatedNextThreeMonths.nextStartIndex;
  const paginatedUntilEndOfYear = getPaginatedCategory(categorizedReminders.untilEndOfYear, runningIndex);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const getPageNumbers = (): (number | 'ellipsis')[] => {
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

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  // Handle paušalni PDF parsed data - create reminders
  const handlePausalniDataParsed = async (data: {
    type: PausalniType;
    year: number;
    monthlyAmounts: number[];
    contributions?: {
      pio: { monthlyAmounts: number[]; recipientAccount: string };
      zdravstveno: { monthlyAmounts: number[]; recipientAccount: string };
      nezaposlenost: { monthlyAmounts: number[]; recipientAccount: string };
    };
    recipientName: string;
    recipientAccount: string;
    paymentModel: string;
    paymentReference: string;
    paymentCode: string;
    payerName: string;
  }) => {
    if (!selectedCompany) return;

    setIsCreatingBulk(true);

    const months = [
      'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
      'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
    ];

    const contributionLabels = {
      pio: 'PIO',
      zdravstveno: 'Zdravstveno',
      nezaposlenost: 'Nezaposlenost',
    };

    const contributionRecipients = {
      pio: 'Републички фонд за ПИО',
      zdravstveno: 'Републички фонд за здравствено осигурање',
      nezaposlenost: 'Национална служба за запошљавање',
    };

    try {
      if (data.type === 'doprinosi' && data.contributions) {
        // Create 12 reminders for each of the 3 contribution types = 36 total
        for (const contribType of ['pio', 'zdravstveno', 'nezaposlenost'] as const) {
          const contrib = data.contributions[contribType];
          
          for (let i = 0; i < 12; i++) {
            const monthName = months[i];
            const amount = contrib.monthlyAmounts[i] || contrib.monthlyAmounts[0] || 0;
            
            const dueMonth = i + 1;
            const dueYear = dueMonth === 12 ? data.year + 1 : data.year;
            const dueDateMonth = dueMonth === 12 ? 0 : dueMonth;
            const dueDate = new Date(dueYear, dueDateMonth, 15);
            
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - 7);

            await createReminder.mutateAsync({
              company_id: selectedCompany.id,
              title: `${contributionLabels[contribType]} - ${monthName} ${data.year}`,
              description: `Mesečna obaveza za ${monthName.toLowerCase()} ${data.year}. godine`,
              amount: amount,
              due_date: dueDate.toISOString().split('T')[0],
              reminder_date: reminderDate.toISOString().split('T')[0],
              is_completed: false,
              recurrence_type: 'none' as const,
              recurrence_day: null,
              attachment_url: null,
              recipient_name: contributionRecipients[contribType],
              recipient_account: contrib.recipientAccount,
              payment_model: data.paymentModel,
              payment_reference: data.paymentReference,
              payment_code: data.paymentCode,
            });
          }
        }

        toast({
          title: 'Podsetnici kreirani',
          description: `Uspešno kreirano 36 podsetnika za doprinose (PIO, Zdravstveno, Nezaposlenost) za ${data.year}. godinu`,
        });
      } else {
        // Create 12 reminders for porez
        for (let i = 0; i < 12; i++) {
          const monthName = months[i];
          const amount = data.monthlyAmounts[i] || data.monthlyAmounts[0] || 0;
          
          const dueMonth = i + 1;
          const dueYear = dueMonth === 12 ? data.year + 1 : data.year;
          const dueDateMonth = dueMonth === 12 ? 0 : dueMonth;
          const dueDate = new Date(dueYear, dueDateMonth, 15);
          
            const reminderDate = new Date(dueDate);
            reminderDate.setDate(reminderDate.getDate() - 7);

          await createReminder.mutateAsync({
            company_id: selectedCompany.id,
            title: `Porez - ${monthName} ${data.year}`,
            description: `Mesečna obaveza za ${monthName.toLowerCase()} ${data.year}. godine`,
            amount: amount,
            due_date: dueDate.toISOString().split('T')[0],
            reminder_date: reminderDate.toISOString().split('T')[0],
            is_completed: false,
            recurrence_type: 'none' as const,
            recurrence_day: null,
            attachment_url: null,
            recipient_name: data.recipientName,
            recipient_account: data.recipientAccount,
            payment_model: data.paymentModel,
            payment_reference: data.paymentReference,
            payment_code: data.paymentCode,
          });
        }

        toast({
          title: 'Podsetnici kreirani',
          description: `Uspešno kreirano 12 podsetnika za porez za ${data.year}. godinu`,
        });
      }
    } catch (error) {
      console.error('Error creating bulk reminders:', error);
      toast({
        title: 'Greška',
        description: 'Došlo je do greške pri kreiranju podsetnika',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingBulk(false);
    }
  };

  const openPausalniDialog = (type: PausalniType) => {
    setPausalniType(type);
    setPausalniDialogOpen(true);
  };

  // Helper to render a single reminder item
  const renderReminderItem = (reminder: Reminder, showOverdueBadge: boolean) => (
    <div
      key={reminder.id}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border ${
        showOverdueBadge ? 'border-destructive bg-destructive/5' : 'bg-secondary'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <Checkbox
          checked={reminder.is_completed}
          onCheckedChange={() => handleToggle(reminder.id, reminder.is_completed)}
          className="mt-1 sm:mt-0 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm sm:text-base">{reminder.title}</p>
            {showOverdueBadge && (
              <Badge variant="destructive" className="text-[10px] sm:text-xs">Istekao</Badge>
            )}
            {reminder.recurrence_type && reminder.recurrence_type !== 'none' && (
              <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs">
                <Repeat className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">
                  {reminder.recurrence_type === 'monthly' && 'Mesečno'}
                  {reminder.recurrence_type === 'quarterly' && 'Kvartalno'}
                  {reminder.recurrence_type === 'yearly' && 'Godišnje'}
                </span>
              </Badge>
            )}
          </div>
          {reminder.description && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{reminder.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Rok: {new Date(reminder.due_date).toLocaleDateString('sr-RS')}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 pl-7 sm:pl-0">
        {reminder.amount && (
          <p className="font-semibold text-sm sm:text-base">{formatCurrency(reminder.amount)}</p>
        )}
        <div className="flex gap-1">
          {reminder.amount && reminder.recipient_account && reminder.recipient_name && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleShowQR(reminder)} title="IPS QR kod">
              <QrCode className="h-4 w-4" />
            </Button>
          )}
          {reminder.attachment_url && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleViewAttachment(reminder)} title="Prikaži PDF">
              <Download className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(reminder)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteId(reminder.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Izaberite firmu</h1>
        <p className="text-muted-foreground">Izaberite firmu iz menija da biste videli podsetnike.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Podsetnici</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Podsetnici za plaćanje obaveza</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                Novi podsetnik
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editId ? 'Izmeni podsetnik' : 'Novi podsetnik'}</DialogTitle>
                <DialogDescription>
                  Unesite podatke o obavezi plaćanja
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="title">Naziv obaveze *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="npr. Paušalni porez, Zdravstveno osiguranje..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Opis</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Dodatne informacije o obavezi"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Iznos (RSD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Rok plaćanja *</Label>
                    <DateInput
                      id="due_date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder_date">Datum podsetnika</Label>
                  <DateInput
                    id="reminder_date"
                    value={formData.reminder_date}
                    onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Datum kada želite da vas podseti (pre roka plaćanja)
                  </p>
                </div>

                {/* Recurrence */}
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base">Ponavljanje</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatski kreira sledeći podsetnik nakon završetka
                    </p>
                    <Select
                      value={formData.recurrence_type}
                      onValueChange={(v: 'none' | 'monthly' | 'quarterly' | 'yearly') => setFormData({ 
                        ...formData, 
                        recurrence_type: v,
                        recurrence_day: v !== 'none' ? (formData.recurrence_day || new Date(formData.due_date || Date.now()).getDate().toString()) : ''
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberi tip ponavljanja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Bez ponavljanja</SelectItem>
                        <SelectItem value="monthly">Mesečno</SelectItem>
                        <SelectItem value="quarterly">Kvartalno (svaka 3 meseca)</SelectItem>
                        <SelectItem value="yearly">Godišnje</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.recurrence_type !== 'none' && (
                    <div className="space-y-2">
                      <Label htmlFor="recurrence_day">Dan u mesecu</Label>
                      <Select
                        value={formData.recurrence_day}
                        onValueChange={(v) => setFormData({ ...formData, recurrence_day: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Izaberi dan" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={day.toString()}>
                              {day}. u mesecu
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* PDF Attachment */}
                <div className="border-t pt-4 space-y-2">
                  <Label>Prilog (PDF)</Label>
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {formData.attachment_url ? (
                    <div className="flex items-center gap-2 p-2 bg-secondary rounded">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm flex-1 truncate">PDF priložen</span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setFormData({ ...formData, attachment_url: '' })}
                      >
                        Ukloni
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full"
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      {uploading ? 'Učitavanje...' : 'Dodaj PDF'}
                    </Button>
                  )}
                </div>

                {/* IPS QR Code Fields */}
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    <Label className="text-base">Podaci za IPS QR kod</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Popunite podatke primaoca za generisanje QR koda za plaćanje
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="recipient_name">Primalac</Label>
                    <Input
                      id="recipient_name"
                      value={formData.recipient_name}
                      onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                      placeholder="Naziv primaoca"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient_account">Broj računa primaoca</Label>
                    <Input
                      id="recipient_account"
                      value={formData.recipient_account}
                      onChange={(e) => setFormData({ ...formData, recipient_account: e.target.value })}
                      onBlur={(e) => {
                        // Auto-format account number with proper Serbian bank account format
                        // Format: XXX-YYYYYYYYYYYYY-ZZ (3 digits - 13 digits - 2 digits = 18 total)
                        const value = e.target.value.trim();
                        const parts = value.split('-');
                        
                        if (parts.length === 3) {
                          // Format with dashes: pad middle part with zeros after first dash
                          const bank = parts[0].replace(/\D/g, '').padStart(3, '0').substring(0, 3);
                          const account = parts[1].replace(/\D/g, '').padStart(13, '0').substring(0, 13);
                          const control = parts[2].replace(/\D/g, '').padStart(2, '0').substring(0, 2);
                          setFormData({ ...formData, recipient_account: `${bank}-${account}-${control}` });
                        } else {
                          // No dashes: try to parse as continuous digits
                          const digits = value.replace(/\D/g, '');
                          if (digits.length > 0 && digits.length <= 18) {
                            // Assume format: first 3 = bank, last 2 = control, middle = account
                            if (digits.length >= 5) {
                              const bank = digits.substring(0, 3).padStart(3, '0');
                              const control = digits.substring(digits.length - 2);
                              const account = digits.substring(3, digits.length - 2).padStart(13, '0');
                              setFormData({ ...formData, recipient_account: `${bank}-${account}-${control}` });
                            } else {
                              setFormData({ ...formData, recipient_account: digits.padStart(18, '0') });
                            }
                          }
                        }
                      }}
                      placeholder="npr. 265-1234567890123-12"
                    />
                    <p className="text-xs text-muted-foreground">Format: XXX-XXXXXXXXXXXXX-XX (nule se dodaju iza prve crte)</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_model">Model</Label>
                      <Input
                        id="payment_model"
                        value={formData.payment_model}
                        onChange={(e) => setFormData({ ...formData, payment_model: e.target.value })}
                        onBlur={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          if (digits.length > 0) {
                            setFormData({ ...formData, payment_model: digits.padStart(2, '0').substring(0, 2) });
                          }
                        }}
                        placeholder="97"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_reference">Poziv na broj</Label>
                      <Input
                        id="payment_reference"
                        value={formData.payment_reference}
                        onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                        placeholder="npr. 1234567890"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_code">Šifra plaćanja</Label>
                    <Input
                      id="payment_code"
                      value={formData.payment_code}
                      onChange={(e) => setFormData({ ...formData, payment_code: e.target.value })}
                      onBlur={(e) => {
                        // Auto-format payment code: ensure 3 digits
                        const digits = e.target.value.replace(/\D/g, '');
                        if (digits.length > 0) {
                          setFormData({ ...formData, payment_code: digits.padStart(3, '0').substring(0, 3) });
                        }
                      }}
                      placeholder="289"
                    />
                    <p className="text-xs text-muted-foreground">3 cifre, automatski se popunjava nulama</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Otkaži
                </Button>
                <Button type="submit" disabled={createReminder.isPending || updateReminder.isPending}>
                  {(createReminder.isPending || updateReminder.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editId ? 'Sačuvaj' : 'Dodaj'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Dropdown for paušalni podsetnici */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={isCreatingBulk}>
              {isCreatingBulk ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openPausalniDialog('porez')}>
              <FileText className="mr-2 h-4 w-4" />
              Podsetnik za poreze
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPausalniDialog('doprinosi')}>
              <FileText className="mr-2 h-4 w-4" />
              Podsetnik za doprinose
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reminders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nemate podsetnika</p>
            <p className="text-muted-foreground mb-4">Dodajte podsetnik za mesečne obaveze</p>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj podsetnik
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Overdue Reminders */}
          {paginatedOverdue.items.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Istekli
                  <Badge variant="destructive" className="ml-2">{categorizedReminders.overdue.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paginatedOverdue.items.map((reminder) => renderReminderItem(reminder, true))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Month Reminders */}
          {paginatedCurrentMonth.items.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tekući mesec
                  <Badge variant="secondary" className="ml-2">{categorizedReminders.currentMonth.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paginatedCurrentMonth.items.map((reminder) => renderReminderItem(reminder, false))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next 3 Months Reminders */}
          {paginatedNextThreeMonths.items.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Naredna 3 meseca
                  <Badge variant="secondary" className="ml-2">{categorizedReminders.nextThreeMonths.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paginatedNextThreeMonths.items.map((reminder) => renderReminderItem(reminder, false))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Until End of Year Reminders */}
          {paginatedUntilEndOfYear.items.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarRange className="h-5 w-5" />
                  Do kraja godine
                  <Badge variant="secondary" className="ml-2">{categorizedReminders.untilEndOfYear.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paginatedUntilEndOfYear.items.map((reminder) => renderReminderItem(reminder, false))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state for active reminders */}
          {allActiveReminders.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nemate aktivnih podsetnika</p>
                <p className="text-muted-foreground mb-4">Dodajte podsetnik za mesečne obaveze</p>
                <Button onClick={() => setIsOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Dodaj podsetnik
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalActiveReminders > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Prikaži:</span>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  od {totalActiveReminders} aktivnih
                </span>
              </div>
              
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {getPageNumbers().map((page, idx) => (
                      <PaginationItem key={idx}>
                        {page === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}

          {/* Completed Reminders */}
          {completedReminders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-muted-foreground">Završeni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {completedReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50 opacity-60"
                    >
                      <Checkbox
                        checked={reminder.is_completed}
                        onCheckedChange={() => handleToggle(reminder.id, reminder.is_completed)}
                      />
                      <div className="flex-1">
                        <p className="line-through">{reminder.title}</p>
                      </div>
                      {reminder.amount && (
                        <p className="text-sm">{formatCurrency(reminder.amount)}</p>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(reminder.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">IPS QR kod za plaćanje</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Skenirajte QR kod mobilnom aplikacijom
            </DialogDescription>
          </DialogHeader>
           {selectedReminder && selectedReminder.recipient_account && selectedReminder.recipient_name && selectedReminder.amount && (
             <div className="flex flex-col items-center space-y-3 sm:space-y-4 py-2 sm:py-4">
               <div className="bg-white p-3 sm:p-4 rounded-lg">
                 <QRCodeSVG
                   value={generateIPSQRCode(
                     selectedReminder.recipient_name,
                     selectedReminder.recipient_account,
                     selectedReminder.amount,
                     selectedReminder.title,
                     selectedCompany.name,
                     selectedCompany.address,
                     selectedReminder.payment_code || '289',
                     selectedReminder.payment_model || '97',
                     selectedReminder.payment_reference || ''
                   )}
                   size={160}
                   level="M"
                   className="sm:w-[200px] sm:h-[200px]"
                 />
               </div>
              <div className="text-center space-y-1">
                <p className="font-medium">{selectedReminder.title}</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(selectedReminder.amount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Primalac: {selectedReminder.recipient_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Račun: {selectedReminder.recipient_account}
                </p>
                {(selectedReminder.payment_model || selectedReminder.payment_reference) && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Model: {selectedReminder.payment_model || '-'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Poziv na broj: {selectedReminder.payment_reference || '-'}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši podsetnik?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati podsetnik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paušalni PDF Dialog */}
      <PausalniPdfDialog
        open={pausalniDialogOpen}
        onOpenChange={setPausalniDialogOpen}
        type={pausalniType}
        onDataParsed={handlePausalniDataParsed}
      />
    </div>
  );
}
