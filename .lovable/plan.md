

# Plan: Drive Share Dialog and Version History

## Scope

Two features added to the Drive module:

1. **Share Dialog** -- UI to manage the existing `drive_permissions` table, allowing granting read/write/admin access to employees
2. **Version History** -- new `drive_file_versions` table + UI to view and restore previous file versions, plus edge function updates

## Database

### New table: `drive_file_versions`

```sql
CREATE TABLE public.drive_file_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.drive_files(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  s3_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);
```

RLS: tenant members can SELECT; admin/manager roles can INSERT/UPDATE/DELETE. Index on `file_id`.

No other schema changes needed -- `drive_permissions` and `drive_files.version` already exist.

## Frontend Changes (`Drive.tsx`)

### Share Dialog

- Add `Share` and `History` lucide icons to imports
- New state: `shareDialogOpen`, `shareTarget` (type + id + name)
- Add "Share" menu item to file and folder dropdown menus
- Dialog content:
  - Fetch existing permissions from `drive_permissions` where `resource_id = target.id`
  - List current grants with badge (READ/WRITE/ADMIN) and delete button
  - Add form: employee selector (query `employees` table), permission level radio group (Read/Write/Admin), checkbox for "Apply to subfolders"
  - Insert into `drive_permissions` on save
- Uses existing table columns: `resource_type`, `resource_id`, `subject_type` (USER), `subject_id`, `permission_level`, `tenant_id`, `granted_by`, `propagate_to_children`

### Version History Dialog

- New state: `versionDialogOpen`, `versionFileId`
- Add "Version History" menu item to file dropdown
- Dialog content:
  - Current version info (version number from `drive_files.version`, upload date)
  - List of previous versions from `drive_file_versions` ordered by `version_number DESC`
  - Each row: version number, date, size, uploader
  - "Restore" button calls edge function `restore_version` action
  - "Download" button calls edge function with version's `s3_key`
  - "Upload New Version" button triggers file input, calls `upload_new_version` action

## Edge Function (`drive-presign/index.ts`)

### New action: `upload_new_version`

1. Fetch current file's `s3_key`, `version`, `size_bytes`, `mime_type`
2. Insert current state into `drive_file_versions` (archiving it)
3. Generate new `s3_key` and presigned PUT URL
4. Update `drive_files` with new `s3_key`, increment `version`, update `size_bytes`
5. Return `{ presignedUrl, fileId, s3Key, newVersion }`

### New action: `restore_version`

1. Fetch current file and target version from `drive_file_versions`
2. Archive current state into `drive_file_versions`
3. Copy restored version's `s3_key` back to `drive_files`, increment `version`
4. Return `{ success: true, restoredVersion }`

### New action: `download_version`

1. Fetch version record from `drive_file_versions`
2. Generate presigned GET URL for that version's `s3_key`
3. Return `{ presignedUrl }`

## Translations (`translations.ts`)

Add keys: `share`, `shareWith`, `permissionLevel`, `readAccess`, `writeAccess`, `adminAccess`, `applyToSubfolders`, `versionHistory`, `currentVersion`, `restoreVersion`, `uploadNewVersion`, `noVersions`, `removeAccess`

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Create `drive_file_versions` table with RLS |
| `supabase/functions/drive-presign/index.ts` | Add `upload_new_version`, `restore_version`, `download_version` actions |
| `src/pages/tenant/Drive.tsx` | Add Share dialog, Version History dialog, new menu items |
| `src/i18n/translations.ts` | Add translation keys |

