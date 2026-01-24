import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cyrillicToLatin } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

export interface DocumentFolder {
  id: string;
  company_id: string;
  name: string;
  color: string | null;
  position: number;
  created_at: string;
}

export interface Document {
  id: string;
  company_id: string;
  folder_id: string | null;
  name: string;
  name_normalized: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useDocuments(companyId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['document-folders', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_folders')
        .select('*')
        .eq('company_id', companyId!)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as DocumentFolder[];
    },
    enabled: !!companyId,
  });

  // Fetch documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Document[];
    },
    enabled: !!companyId,
  });

  // Create folder
  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const maxPosition = folders.reduce((max, f) => Math.max(max, f.position), 0);
      const { data, error } = await supabase
        .from('document_folders')
        .insert({
          company_id: companyId!,
          name,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      toast({ title: 'Folder je kreiran' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Update folder
  const updateFolder = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const { error } = await supabase
        .from('document_folders')
        .update({ name, color })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      toast({ title: 'Folder je ažuriran' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Delete folder
  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Folder je obrisan' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Upload document
  const uploadDocument = useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: string | null }) => {
      const nameNormalized = cyrillicToLatin(file.name).toLowerCase();
      const folderPath = folderId || 'general';
      const path = `${companyId}/${folderPath}/${Date.now()}_${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(path, file);

      if (uploadError) throw uploadError;

      // Insert document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          company_id: companyId!,
          folder_id: folderId,
          name: file.name,
          name_normalized: nameNormalized,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Dokument je upload-ovan' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška pri upload-u', description: error.message, variant: 'destructive' });
    },
  });

  // Delete document
  const deleteDocument = useMutation({
    mutationFn: async (doc: Document) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('company-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Dokument je obrisan' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  // Get signed URL for download
  const getDownloadUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('company-documents')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  // Search documents (supports both Cyrillic and Latin)
  const searchDocuments = (query: string, docs: Document[]): Document[] => {
    if (!query.trim()) return docs;
    const normalizedQuery = cyrillicToLatin(query).toLowerCase();
    return docs.filter(doc => 
      doc.name_normalized.includes(normalizedQuery)
    );
  };

  return {
    folders,
    documents,
    isLoading: foldersLoading || documentsLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    uploadDocument,
    deleteDocument,
    getDownloadUrl,
    searchDocuments,
  };
}
