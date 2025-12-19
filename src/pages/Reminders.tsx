import { useState } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useReminders } from '@/hooks/useReminders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { Bell, Plus, Pencil, Trash2, Loader2, Building2, Calendar, Check } from 'lucide-react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Reminders() {
  const { selectedCompany } = useSelectedCompany();
  const { reminders, isLoading, createReminder, updateReminder, deleteReminder, toggleComplete } = useReminders(selectedCompany?.id || null);
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    due_date: '',
    reminder_date: '',
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      amount: '',
      due_date: '',
      reminder_date: '',
    });
    setEditId(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (reminder: typeof reminders[0]) => {
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      amount: reminder.amount?.toString() || '',
      due_date: reminder.due_date,
      reminder_date: reminder.reminder_date || '',
    });
    setEditId(reminder.id);
    setIsOpen(true);
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
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editId ? 'Izmeni podsetnik' : 'Novi podsetnik'}</DialogTitle>
                <DialogDescription>
                  Unesite podatke o obavezi plaćanja
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{reminder.title}</p>
                          {isOverdue(reminder.due_date) && (
                            <Badge variant="destructive">Istekao rok</Badge>
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
