import { useState, useRef, useMemo } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useReminders, Reminder } from '@/hooks/useReminders';
import { startOfDay, startOfMonth, endOfMonth, endOfYear, addMonths, isBefore, isAfter } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Plus, Pencil, Trash2, Loader2, Building2, Calendar, QrCode, FileText, Repeat, Download, MoreVertical, AlertTriangle, CalendarDays, CalendarRange, Search, X, Check, CheckCircle2, List, Image, File, Paperclip } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import PausalniPdfDialog, { PausalniType, ParsedPausalniData, MonthlyEntry } from '@/components/PausalniPdfDialog';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Cyrillic to Latin conversion for Serbian banking app compatibility
function cyrillicToLatin(text: string): string {
  const map: Record<string, string> = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Ђ': 'Đ', 'Е': 'E',
    'Ж': 'Ž', 'З': 'Z', 'И': 'I', 'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'Lj',
    'М': 'M', 'Н': 'N', 'Њ': 'Nj', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S',
    'Т': 'T', 'Ћ': 'Ć', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Č',
    'Џ': 'Dž', 'Ш': 'Š',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ђ': 'đ', 'е': 'e',
    'ж': 'ž', 'з': 'z', 'и': 'i', 'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj',
    'м': 'm', 'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's',
    'т': 't', 'ћ': 'ć', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'č',
    'џ': 'dž', 'ш': 'š'
  };
  return text.split('').map(char => map[char] || char).join('');
}

// Generate IPS QR code string for Serbian payments (NBS standard)
// Format: https://ips.nbs.rs/PDF/Tehnicki_standard_IPS_QR_koda.pdf
function generateIPSQRCode(
  receiverName: string,
  receiverAccount: string,
  amount: number,
  paymentPurpose: string,
  payerName?: string,
  payerAddress?: string | null,
  paymentCode: string = '253',  // Default 253 for tax payments
  paymentModel: string = '97',
  paymentReference: string = ''
): string {
  // Sanitize text - remove pipe characters, carriage returns, and collapse multiple spaces
  const sanitize = (value: string) => 
    value.replace(/\|/g, ' ').replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Receiver account: must be exactly 18 consecutive digits (no dashes)
  const accountParts = receiverAccount.split('-');
  let formattedAccount: string;
  
  if (accountParts.length === 3) {
    const bank = accountParts[0].replace(/\D/g, '').padStart(3, '0').substring(0, 3);
    const account = accountParts[1].replace(/\D/g, '').padStart(13, '0').substring(0, 13);
    const control = accountParts[2].replace(/\D/g, '').padStart(2, '0').substring(0, 2);
    formattedAccount = bank + account + control;
  } else {
    formattedAccount = receiverAccount.replace(/\D/g, '').padStart(18, '0').substring(0, 18);
  }

  // Amount: NBS IPS uses format "RSD1234,56" (comma as decimal separator)
  const formattedAmount = amount.toFixed(2).replace('.', ',');

  // Receiver name (max 70 chars, sanitized, single line, converted to Latin)
  const n = sanitize(cyrillicToLatin(receiverName)).substring(0, 70);

  // Payment purpose (max 35 chars, sanitized, single line)
  const purpose = sanitize(paymentPurpose).substring(0, 35);
  
  // Payment code (šifra plaćanja) - must be exactly 3 digits
  const sf = paymentCode.replace(/\D/g, '').padStart(3, '0').substring(0, 3);

  // Reference - only digits, no dashes or other characters
  const cleanReference = paymentReference.replace(/\D/g, '');
  
  // Build IPS QR code string with | as separator (per NBS standard)
  const parts = [
    'K:PR',           // Identifier: PR = payment request
    'V:01',           // Version: 01
    'C:1',            // Character set: 1 = UTF-8
    `R:${formattedAccount}`,  // Receiver account (18 digits)
    `N:${n}`,         // Receiver name (Latin script)
    `I:RSD${formattedAmount}`, // Amount with currency
  ];

  // Payer info (P:) - ONLY add if we have payer name, and limit TOTAL to 70 chars
  // Format: "Name\nAddress" but total must not exceed 70 chars
  const payerNameClean = sanitize(payerName || '');
  const payerAddressClean = sanitize(payerAddress || '');
  
  if (payerNameClean) {
    // Kombinujemo ime i adresu u jednu liniju, max 70 karaktera za bolju kompatibilnost
    const fullPayer = payerAddressClean 
      ? `${payerNameClean} ${payerAddressClean}` 
      : payerNameClean;
    parts.push(`P:${fullPayer.substring(0, 70)}`);
  }

  // Add payment code and purpose
  parts.push(`SF:${sf}`);
  parts.push(`S:${purpose}`);
  
      // Koristi prosleđeni model (97 za poreske uplatnice, 00 za ostalo)
      if (cleanReference) {
        const modelDigits = paymentModel.replace(/\D/g, '').padStart(2, '0').substring(0, 2);
        parts.push(`RO:${modelDigits}${cleanReference}`);
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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    due_date: '',
    reminder_date: '',
    recurrence_type: 'none' as 'none' | 'monthly' | 'quarterly' | 'yearly',
    recurrence_day: '',
    attachment_url: '',
    attachment_name: '',
    recipient_name: '',
    recipient_account: '',
    payment_model: '97',
    payment_reference: '',
    payment_code: '253',
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
      attachment_name: '',
      recipient_name: '',
      recipient_account: '',
      payment_model: '97',
      payment_reference: '',
      payment_code: '253',
    });
    setEditId(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (reminder: Reminder) => {
    // Extract filename from attachment_url if exists
    const attachmentName = reminder.attachment_url 
      ? reminder.attachment_url.split('/').pop() || 'Prilog'
      : '';
    
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      amount: reminder.amount?.toString() || '',
      due_date: reminder.due_date,
      reminder_date: reminder.reminder_date || '',
      recurrence_type: reminder.recurrence_type || 'none',
      recurrence_day: reminder.recurrence_day?.toString() || '',
      attachment_url: reminder.attachment_url || '',
      attachment_name: attachmentName,
      recipient_name: reminder.recipient_name || '',
      recipient_account: reminder.recipient_account || '',
      payment_model: reminder.payment_model || '97',
      payment_reference: reminder.payment_reference || '',
      payment_code: reminder.payment_code || '253',
    });
    setEditId(reminder.id);
    setIsOpen(true);
  };

  // Allowed file types for attachments
  const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (ext === 'pdf') {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (['doc', 'docx'].includes(ext || '')) {
      return <File className="h-4 w-4 text-blue-600" />;
    }
    return <Paperclip className="h-4 w-4" />;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Nepodržani format',
        description: 'Dozvoljeni formati: PDF, JPG, PNG, WEBP, DOC, DOCX',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Fajl je prevelik',
        description: 'Maksimalna veličina je 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadAttachment(selectedCompany.id, file);
      setFormData(prev => ({ 
        ...prev, 
        attachment_url: url,
        attachment_name: file.name,
      }));
      toast({
        title: 'Fajl učitan',
        description: file.name,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Greška pri učitavanju',
        description: 'Pokušajte ponovo',
        variant: 'destructive',
      });
    }
    setUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      payment_code: formData.payment_code || '253',
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

  // Filter reminders by search query
  const filteredReminders = useMemo(() => {
    if (!searchQuery.trim()) return reminders;
    const query = searchQuery.toLowerCase();
    return reminders.filter(r =>
      r.title.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query) ||
      r.recipient_name?.toLowerCase().includes(query)
    );
  }, [reminders, searchQuery]);

  const completedReminders = filteredReminders.filter(r => r.is_completed);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Categorize active reminders
  const today = startOfDay(new Date());
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);
  const threeMonthsLater = endOfMonth(addMonths(today, 3));
  const yearEnd = endOfYear(today);

  const categorizedReminders = useMemo(() => {
    const activeReminders = filteredReminders.filter(r => !r.is_completed);
    
    // Istekli: samo podsetnici čiji je due_date bio PRE početka tekućeg meseca
    const overdue = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return isBefore(dueDate, currentMonthStart);
    }).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

    // Tekući mesec: svi podsetnici unutar tekućeg meseca (1. do kraja), bez obzira da li je rok prošao
    // Sortiranje: prvo oni sa prošlim rokom (hitni), pa ostali po datumu
    const currentMonth = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return !isBefore(dueDate, currentMonthStart) && !isAfter(dueDate, currentMonthEnd);
    }).sort((a, b) => {
      const dateA = startOfDay(new Date(a.due_date));
      const dateB = startOfDay(new Date(b.due_date));
      const aIsPast = isBefore(dateA, today);
      const bIsPast = isBefore(dateB, today);
      // Ako jedan je prošao a drugi nije, prošao ide prvi
      if (aIsPast && !bIsPast) return -1;
      if (!aIsPast && bIsPast) return 1;
      // Ako su oba prošla ili oba nisu, sortiraj po datumu
      return dateA.getTime() - dateB.getTime();
    });

    const nextThreeMonths = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return isAfter(dueDate, currentMonthEnd) && !isAfter(dueDate, threeMonthsLater);
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const untilEndOfYear = activeReminders.filter(r => {
      const dueDate = startOfDay(new Date(r.due_date));
      return isAfter(dueDate, threeMonthsLater) && !isAfter(dueDate, yearEnd);
    }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    // Svi aktivni podsetnici (uključujući i one za narednu godinu) - sortirano po datumu
    const all = activeReminders.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    return { overdue, currentMonth, nextThreeMonths, untilEndOfYear, all };
  }, [filteredReminders, today, currentMonthStart, currentMonthEnd, threeMonthsLater, yearEnd]);

  // All active reminders for bulk operations and empty state
  const allActiveReminders = [
    ...categorizedReminders.overdue,
    ...categorizedReminders.currentMonth,
    ...categorizedReminders.nextThreeMonths,
    ...categorizedReminders.untilEndOfYear,
  ];

  // Active tab state for independent pagination
  const [activeTab, setActiveTab] = useState('currentMonth');

  // Get reminders for the active tab
  const getActiveTabReminders = () => {
    switch (activeTab) {
      case 'currentMonth': return categorizedReminders.currentMonth;
      case 'nextThreeMonths': return categorizedReminders.nextThreeMonths;
      case 'untilEndOfYear': return categorizedReminders.untilEndOfYear;
      case 'overdue': return categorizedReminders.overdue;
      case 'archived': return completedReminders;
      case 'all': return categorizedReminders.all;
      default: return [];
    }
  };

  const activeTabReminders = getActiveTabReminders();
  const totalItems = activeTabReminders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = activeTabReminders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

  // Bulk selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (category: Reminder[]) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      const allSelected = category.every(r => newSet.has(r.id));
      if (allSelected) {
        category.forEach(r => newSet.delete(r.id));
      } else {
        category.forEach(r => newSet.add(r.id));
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteReminder.mutateAsync(id);
      }
      toast({ title: `Obrisano ${selectedIds.size} podsetnika` });
      setSelectedIds(new Set());
      setBulkDeleteDialogOpen(false);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({ title: 'Greška', description: 'Došlo je do greške pri brisanju', variant: 'destructive' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Handle paušalni PDF parsed data - create reminders
  const handlePausalniDataParsed = async (data: ParsedPausalniData) => {
    if (!selectedCompany) return;

    setIsCreatingBulk(true);

    const monthNames = [
      'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
      'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
    ];

    const contributionLabels: Record<string, string> = {
      pio: 'PIO',
      zdravstveno: 'Zdravstveno',
      nezaposlenost: 'Nezaposlenost',
    };

    const accounts: Record<string, string> = {
      pio: '840-721313843-74',
      zdravstveno: '840-721325843-61',
      nezaposlenost: '840-721331843-06',
    };

    try {
      if (data.type === 'doprinosi' && data.entries) {
        // Create reminders ONLY for months and types that exist with amount > 0
        let createdCount = 0;
        
        for (const entry of data.entries) {
          const monthName = monthNames[entry.month - 1];
          
          // Process each contribution type, but only if amount > 0
          for (const contribType of ['pio', 'zdravstveno', 'nezaposlenost'] as const) {
            const amount = entry[contribType];
            
            // Skip if amount is 0 or undefined
            if (!amount || amount <= 0) continue;
            
            // Calculate due date (15th of following month)
            const dueMonth = entry.month;
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
              recipient_name: data.recipientName,
              recipient_account: accounts[contribType],
              payment_model: data.paymentModel,
              payment_reference: data.paymentReference,
              payment_code: data.paymentCode,
            });
            
            createdCount++;
          }
        }

        toast({
          title: 'Podsetnici kreirani',
          description: `Uspešno kreirano ${createdCount} podsetnika za ${data.year}. godinu`,
        });
      } else {
        // Create 12 reminders for porez
        for (let i = 0; i < 12; i++) {
          const monthName = monthNames[i];
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

  // State for bulk select mode
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  // Helper to check if a reminder's due date has passed (for urgent indicator in current month)
  const isPastDueDate = (dueDate: string) => {
    return startOfDay(new Date(dueDate)) < today;
  };

  // Helper to render a single reminder item
  // showOverdueBadge: for expired tab (red)
  // showUrgentBadge: for current month items that passed due date (orange)
  const renderReminderItem = (reminder: Reminder, showOverdueBadge: boolean, showUrgentBadge: boolean = false) => (
    <div
      key={reminder.id}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border ${
        showOverdueBadge ? 'border-destructive bg-destructive/5' : 
        showUrgentBadge ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20' : 'bg-secondary'
      } ${selectedIds.has(reminder.id) ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        {bulkSelectMode && (
          <div className="flex items-center gap-2 mt-1 sm:mt-0 flex-shrink-0">
            <Checkbox
              checked={selectedIds.has(reminder.id)}
              onCheckedChange={() => handleToggleSelect(reminder.id)}
              className="border-muted-foreground/50"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm sm:text-base">{reminder.title}</p>
            {showOverdueBadge && (
              <Badge variant="destructive" className="text-[10px] sm:text-xs">Istekao</Badge>
            )}
            {showUrgentBadge && (
              <Badge className="text-[10px] sm:text-xs bg-orange-500 hover:bg-orange-600 text-white">Hitno</Badge>
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
      <div className="flex items-center justify-between sm:justify-end gap-2 pl-0 sm:pl-0">
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
          <Button 
            size="icon" 
            variant={reminder.is_completed ? "default" : "outline"}
            className={`h-8 w-8 ${reminder.is_completed ? 'bg-green-500 hover:bg-green-600 border-green-500' : 'hover:bg-green-100 hover:border-green-500'}`}
            onClick={() => handleToggle(reminder.id, reminder.is_completed)}
            title={reminder.is_completed ? "Označeno kao plaćeno" : "Označi kao plaćeno"}
          >
            <Check className={`h-4 w-4 ${reminder.is_completed ? 'text-white' : 'text-green-600'}`} />
          </Button>
        </div>
      </div>
    </div>
  );

  // Helper to render archived reminder item
  const renderArchivedItem = (reminder: Reminder) => (
    <div
      key={reminder.id}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ${selectedIds.has(reminder.id) ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        {bulkSelectMode && (
          <div className="flex items-center gap-2 mt-1 sm:mt-0 flex-shrink-0">
            <Checkbox
              checked={selectedIds.has(reminder.id)}
              onCheckedChange={() => handleToggleSelect(reminder.id)}
              className="border-muted-foreground/50"
            />
          </div>
        )}
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-1 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm sm:text-base">{reminder.title}</p>
          <p className="text-xs text-muted-foreground">
            Plaćeno: {new Date(reminder.due_date).toLocaleDateString('sr-RS')}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 pl-0 sm:pl-0">
        {reminder.amount && (
          <p className="font-semibold text-sm sm:text-base">{formatCurrency(reminder.amount)}</p>
        )}
        <div className="flex gap-1">
          <Button 
            size="icon" 
            variant="outline" 
            className="h-8 w-8"
            onClick={() => handleToggle(reminder.id, reminder.is_completed)}
            title="Vrati u aktivne"
          >
            <X className="h-4 w-4" />
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

      {/* Search Input */}
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretraži podsetnike..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10 pr-8"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
            onClick={() => {
              setSearchQuery('');
              setCurrentPage(1);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
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

                {/* File Attachment */}
                <div className="border-t pt-4 space-y-2">
                  <Label>Prilog (PDF, slika, dokument)</Label>
                  <p className="text-xs text-muted-foreground">
                    Dozvoljeni formati: PDF, JPG, PNG, WEBP, DOC, DOCX (max 10MB)
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {formData.attachment_url ? (
                    <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg border">
                      {getFileIcon(formData.attachment_name || formData.attachment_url)}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {formData.attachment_name || 'Prilog'}
                        </span>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setFormData({ ...formData, attachment_url: '', attachment_name: '' })}
                      >
                        <X className="h-4 w-4" />
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
                        <Paperclip className="mr-2 h-4 w-4" />
                      )}
                      {uploading ? 'Učitavanje...' : 'Dodaj prilog'}
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
                <Button type="submit" disabled={createReminder.isPending || updateReminder.isPending || uploading}>
                  {(createReminder.isPending || updateReminder.isPending || uploading) && (
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
          <DropdownMenuContent align="end" className="bg-background">
            <DropdownMenuItem onClick={() => openPausalniDialog('porez')}>
              <FileText className="mr-2 h-4 w-4" />
              Podsetnik za poreze
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPausalniDialog('doprinosi')}>
              <FileText className="mr-2 h-4 w-4" />
              Podsetnik za doprinose
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              setBulkSelectMode(true);
              setSelectedIds(new Set());
            }}>
              <Trash2 className="mr-2 h-4 w-4" />
              Obriši više podsetnika
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
          <Tabs defaultValue="currentMonth" value={activeTab} onValueChange={(value) => { setActiveTab(value); setCurrentPage(1); }} className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="currentMonth" className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-2 py-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-sm">Tekući mesec</span>
              <Badge variant="secondary" className="ml-1">{categorizedReminders.currentMonth.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="nextThreeMonths" className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-2 py-2">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-sm">Naredna 3 meseca</span>
              <Badge variant="secondary" className="ml-1">{categorizedReminders.nextThreeMonths.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="untilEndOfYear" className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-2 py-2">
              <CalendarRange className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-sm">Do kraja godine</span>
              <Badge variant="secondary" className="ml-1">{categorizedReminders.untilEndOfYear.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-2 py-2 data-[state=active]:text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-sm">Istekli</span>
              <Badge variant="destructive" className="ml-1">{categorizedReminders.overdue.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-2 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <span className="hidden sm:inline text-sm">Arhivirano</span>
              <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{completedReminders.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-2 py-2">
              <List className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-sm">Svi</span>
              <Badge variant="secondary" className="ml-1">{categorizedReminders.all.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Current Month Tab */}
          <TabsContent value="currentMonth" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {paginatedItems.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedItems.map((reminder) => renderReminderItem(reminder, false, isPastDueDate(reminder.due_date)))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nema podsetnika za tekući mesec</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Next 3 Months Tab */}
          <TabsContent value="nextThreeMonths" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {paginatedItems.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedItems.map((reminder) => renderReminderItem(reminder, false))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nema podsetnika za naredna 3 meseca</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Until End of Year Tab */}
          <TabsContent value="untilEndOfYear" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {paginatedItems.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedItems.map((reminder) => renderReminderItem(reminder, false))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CalendarRange className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nema podsetnika do kraja godine</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overdue Tab */}
          <TabsContent value="overdue" className="mt-4">
            <Card className="border-destructive/50">
              <CardContent className="pt-6">
                {paginatedItems.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedItems.map((reminder) => renderReminderItem(reminder, true))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nema isteklih podsetnika</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Archived Tab */}
          <TabsContent value="archived" className="mt-4">
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                {paginatedItems.length > 0 ? (
                  <div className="space-y-3">
                    {activeTab === 'archived' 
                      ? paginatedItems.map((reminder) => renderArchivedItem(reminder))
                      : paginatedItems.map((reminder) => renderReminderItem(reminder, false))
                    }
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nema arhiviranih podsetnika</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Reminders Tab */}
          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {paginatedItems.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedItems.map((reminder) => renderReminderItem(reminder, isOverdue(reminder.due_date), isPastDueDate(reminder.due_date)))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <List className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nema aktivnih podsetnika</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Empty state for all reminders */}
        {allActiveReminders.length === 0 && categorizedReminders.overdue.length === 0 && (
          <Card className="mt-4">
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
        )}

        {/* Pagination */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
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
                od {totalItems} podsetnika
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
             (() => {
               const ipsString = generateIPSQRCode(
                 selectedReminder.recipient_name,
                 selectedReminder.recipient_account,
                 selectedReminder.amount,
                 selectedReminder.title,
                 selectedCompany?.name,
                 selectedCompany?.address,
                 selectedReminder.payment_code || '253',
                 selectedReminder.payment_model || '97',
                 selectedReminder.payment_reference || ''
               );
               return (
                 <div className="flex flex-col items-center space-y-3 sm:space-y-4 py-2 sm:py-4">
                   <div className="bg-white p-3 sm:p-4 rounded-lg">
                     <QRCodeSVG
                       value={ipsString}
                       size={160}
                       level="L"
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
                       Račun: {(() => {
                         const parts = selectedReminder.recipient_account?.split('-') || [];
                         if (parts.length === 3) {
                           const bank = parts[0].replace(/\D/g, '').padStart(3, '0').substring(0, 3);
                           const account = parts[1].replace(/\D/g, '').padStart(13, '0').substring(0, 13);
                           const control = parts[2].replace(/\D/g, '').padStart(2, '0').substring(0, 2);
                           return `${bank}-${account}-${control}`;
                         }
                         return selectedReminder.recipient_account;
                       })()}
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
               );
             })()
           )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
              Zatvori
            </Button>
          </div>
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

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši {selectedIds.size} podsetnika?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova akcija će trajno obrisati sve selektovane podsetnike. Ova radnja se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Brisanje...
                </>
              ) : (
                `Obriši ${selectedIds.size}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Action Bar for Bulk Selection */}
      {bulkSelectMode && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-card border rounded-lg shadow-lg p-3 flex items-center gap-4 z-50">
          <span className="text-sm font-medium">{selectedIds.size} selektovano</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              // Select/deselect all active reminders
              const allActive = allActiveReminders;
              const allSelected = allActive.length > 0 && allActive.every(r => selectedIds.has(r.id));
              if (allSelected) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(allActive.map(r => r.id)));
              }
            }}
          >
            {allActiveReminders.length > 0 && allActiveReminders.every(r => selectedIds.has(r.id)) 
              ? 'Poništi sve' 
              : 'Selektuj sve'}
          </Button>
          {selectedIds.size > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Poništi selekciju
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Obriši
              </Button>
            </>
          )}
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => {
              setBulkSelectMode(false);
              clearSelection();
            }}
          >
            <Check className="h-4 w-4 mr-2" />
            Gotovo
          </Button>
        </div>
      )}
    </div>
  );
}
