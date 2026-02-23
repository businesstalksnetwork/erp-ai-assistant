import { supabase } from '@/integrations/supabase/client';

export type StorageType = 'logo' | 'document' | 'reminder' | 'invoice';

export interface UploadOptions {
  type: StorageType;
  companyId: string;
  file: File;
  folderId?: string | null;
  invoiceId?: string | null;
}

export interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

/**
 * Upload a file to DigitalOcean Spaces via edge function
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { type, companyId, file, folderId, invoiceId } = options;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  formData.append('companyId', companyId);
  if (folderId) formData.append('folderId', folderId);
  if (invoiceId) formData.append('invoiceId', invoiceId);

  const { data, error } = await supabase.functions.invoke('storage-upload', {
    body: formData,
  });

  if (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || 'Upload failed' };
  }

  return {
    success: true,
    path: data.path,
    url: data.url,
  };
}

/**
 * Get a signed URL for downloading a private file
 */
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<DownloadResult> {
  // If path is already a full URL (for logos), return it directly
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return { success: true, signedUrl: path };
  }

  const { data, error } = await supabase.functions.invoke('storage-download', {
    body: { path, expiresIn },
  });

  if (error) {
    console.error('Download URL error:', error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || 'Failed to get download URL' };
  }

  return {
    success: true,
    signedUrl: data.signedUrl,
  };
}

/**
 * Delete file(s) from storage
 */
export async function deleteFiles(paths: string | string[]): Promise<{ success: boolean; error?: string }> {
  const pathArray = Array.isArray(paths) ? paths : [paths];
  
  // Filter out any paths that are full URLs (old Supabase URLs) - these can't be deleted via DO
  const doSpacesPaths = pathArray.filter(p => p.startsWith('users/'));
  
  if (doSpacesPaths.length === 0) {
    return { success: true }; // Nothing to delete from DO Spaces
  }

  const { data, error } = await supabase.functions.invoke('storage-delete', {
    body: { paths: doSpacesPaths },
  });

  if (error) {
    console.error('Delete error:', error);
    return { success: false, error: error.message };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || 'Delete failed' };
  }

  return { success: true };
}

/**
 * Helper to check if a path is a DO Spaces path (vs old Supabase URL)
 */
export function isDoSpacesPath(path: string): boolean {
  return path.startsWith('users/');
}

/**
 * Helper to check if URL is a DO Spaces public URL
 */
export function isDoSpacesUrl(url: string): boolean {
  return url.includes('digitaloceanspaces.com');
}
