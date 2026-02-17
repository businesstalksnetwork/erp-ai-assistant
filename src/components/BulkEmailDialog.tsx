import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

interface UserInfo {
  id: string;
  email: string;
  full_name: string | null;
}

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserInfo[];
  onSend: (selectedUsers: UserInfo[]) => Promise<void>;
  isSending: boolean;
}

export function BulkEmailDialog({ open, onOpenChange, users, onSend, isSending }: BulkEmailDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastContactMap, setLastContactMap] = useState<Map<string, string>>(new Map());
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Select all by default when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(users.map(u => u.id)));
      fetchLastContacts();
    }
  }, [open, users]);

  const fetchLastContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from('email_notification_log')
        .select('email_to, created_at, notification_type')
        .or('notification_type.like.admin_bulk_%,notification_type.like.trial_expiring_%')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching last contacts:', error);
        return;
      }

      // Group by email, keep max date
      const map = new Map<string, string>();
      for (const row of data || []) {
        if (!map.has(row.email_to)) {
          map.set(row.email_to, row.created_at);
        }
      }
      setLastContactMap(map);
    } catch (err) {
      console.error('Error fetching last contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const allSelected = selectedIds.size === users.length;
  const noneSelected = selectedIds.size === 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  };

  const toggleUser = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedUsers = useMemo(
    () => users.filter(u => selectedIds.has(u.id)),
    [users, selectedIds]
  );

  const handleSend = () => {
    onSend(selectedUsers);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pošalji email - odaberi primaoce</DialogTitle>
          <DialogDescription>
            Selektujte korisnike kojima želite da pošaljete email. Korisnici koji su već kontaktirani imaju prikazan datum poslednjeg kontakta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? 'Deselektuj sve' : 'Selektuj sve'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} od {users.length} selektovano
          </span>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh] border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Ime</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Poslednji kontakt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const lastContact = lastContactMap.get(user.email);
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.full_name || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-sm">
                      {isLoadingContacts ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : lastContact ? (
                        <span className="text-warning">
                          {format(new Date(lastContact), 'dd.MM.yyyy HH:mm', { locale: sr })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Otkaži
          </Button>
          <Button onClick={handleSend} disabled={noneSelected || isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Šalje se...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Pošalji ({selectedIds.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
