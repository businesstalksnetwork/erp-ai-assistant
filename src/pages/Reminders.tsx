import { useState, useRef } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useReminders, Reminder } from '@/hooks/useReminders';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Bell, Plus, Pencil, Trash2, Loader2, Building2, Calendar, QrCode, FileText, Repeat, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Generate IPS QR code string for Serbian payments
function generateIPSQRCode(
  receiverName: string,
  receiverAccount: string,
  amount: number,
  paymentPurpose: string,
  paymentCode: string = '289',
  paymentModel: string = '97',
  paymentReference: string = ''
): string {
  // IPS QR code format for Serbia (NBS standard)
  const formattedAccount = receiverAccount.replace(/-/g, '');
  const amountInPara = Math.round(amount * 100).toString().padStart(15, '0');
  
  const qrData = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${formattedAccount}`,
    `N:${receiverName.substring(0, 70)}`,
    'I:RSD',
    `A:${amountInPara}`,
    `S:${paymentPurpose.substring(0, 35)}`,
    `SF:${paymentCode}`,
    `RO:${paymentModel}${paymentReference}`,
  ].join('|');
  
  return qrData;
}

export default function Reminders() {
  const { selectedCompany } = useSelectedCompany();
  const { reminders, isLoading, createReminder, updateReminder, deleteReminder, toggleComplete, uploadAttachment, getSignedUrl } = useReminders(selectedCompany?.id || null);
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    due_date: '',
    reminder_date: '',
    recurrence_type: 'none' as 'none' | 'monthly',
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
      recurrence_day: formData.recurrence_type === 'monthly' && formData.recurrence_day 
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

  const activeReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Podsetnici</h1>
          <p className="text-muted-foreground">Podsetnici za plaćanje mesečnih obaveza</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novi podsetnik
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                <div className="grid grid-cols-2 gap-4">
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
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder_date">Datum podsetnika</Label>
                  <Input
                    id="reminder_date"
                    type="date"
                    value={formData.reminder_date}
                    onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Datum kada želite da vas podseti (pre roka plaćanja)
                  </p>
                </div>

                {/* Recurrence */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Ponavljajuća obaveza</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatski kreira sledeći podsetnik nakon završetka
                      </p>
                    </div>
                    <Switch
                      checked={formData.recurrence_type === 'monthly'}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        recurrence_type: checked ? 'monthly' : 'none',
                        recurrence_day: checked ? new Date(formData.due_date || Date.now()).getDate().toString() : ''
                      })}
                    />
                  </div>
                  {formData.recurrence_type === 'monthly' && (
                    <div className="mt-3 space-y-2">
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
                      placeholder="npr. 265-1234567890123-12"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_model">Model</Label>
                      <Input
                        id="payment_model"
                        value={formData.payment_model}
                        onChange={(e) => setFormData({ ...formData, payment_model: e.target.value })}
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
                      placeholder="289"
                    />
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
        <div className="space-y-6">
          {/* Active Reminders */}
          {activeReminders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Aktivni podsetnici</CardTitle>
                <CardDescription>Obaveze koje treba platiti</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${
                        isOverdue(reminder.due_date) ? 'border-destructive bg-destructive/5' : 'bg-secondary'
                      }`}
                    >
                      <Checkbox
                        checked={reminder.is_completed}
                        onCheckedChange={() => handleToggle(reminder.id, reminder.is_completed)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{reminder.title}</p>
                          {isOverdue(reminder.due_date) && (
                            <Badge variant="destructive">Istekao rok</Badge>
                          )}
                          {reminder.recurrence_type === 'monthly' && (
                            <Badge variant="secondary" className="gap-1">
                              <Repeat className="h-3 w-3" />
                              Mesečno
                            </Badge>
                          )}
                          {reminder.attachment_url && (
                            <Badge variant="outline" className="gap-1">
                              <FileText className="h-3 w-3" />
                              PDF
                            </Badge>
                          )}
                        </div>
                        {reminder.description && (
                          <p className="text-sm text-muted-foreground truncate">{reminder.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Rok: {new Date(reminder.due_date).toLocaleDateString('sr-RS')}
                        </div>
                      </div>
                      {reminder.amount && (
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(reminder.amount)}</p>
                        </div>
                      )}
                      <div className="flex gap-1">
                        {reminder.amount && reminder.recipient_account && (
                          <Button size="icon" variant="ghost" onClick={() => handleShowQR(reminder)} title="IPS QR kod">
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                        {reminder.attachment_url && (
                          <Button size="icon" variant="ghost" onClick={() => handleViewAttachment(reminder)} title="Prikaži PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(reminder)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(reminder.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
            <DialogTitle>IPS QR kod za plaćanje</DialogTitle>
            <DialogDescription>
              Skenirajte QR kod mobilnom bankarskom aplikacijom
            </DialogDescription>
          </DialogHeader>
          {selectedReminder && selectedReminder.recipient_account && selectedReminder.amount && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={generateIPSQRCode(
                    selectedReminder.recipient_name || '',
                    selectedReminder.recipient_account,
                    selectedReminder.amount,
                    selectedReminder.title,
                    selectedReminder.payment_code || '289',
                    selectedReminder.payment_model || '97',
                    selectedReminder.payment_reference || ''
                  )}
                  size={200}
                  level="M"
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
                {selectedReminder.payment_reference && (
                  <p className="text-sm text-muted-foreground">
                    Poziv na broj: {selectedReminder.payment_model}-{selectedReminder.payment_reference}
                  </p>
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
    </div>
  );
}
