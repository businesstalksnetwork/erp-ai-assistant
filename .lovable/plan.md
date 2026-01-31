

# Plan: Single User Test Migration

## Test User Selected
- **Email**: `nikolaglintic1994@gmail.com`
- **User ID**: `fabec19c-425d-4d41-b6b1-f84c58cb3a95`
- **Files to migrate**: 1 document

### File Details:
| Type | Current Path | New DO Spaces Path |
|------|--------------|-------------------|
| Document | `0fa69d4b.../general/1769290995384_Invoice-104768.pdf` | `users/fabec19c.../documents/0fa69d4b.../general/1769290995384_Invoice-104768.pdf` |

## Implementation

### Modify `storage-migrate` Edge Function

Add optional `userId` parameter to filter migration to a single user:

```typescript
// Parse request body
const { dryRun = true, userId = null } = await req.json();

// When fetching companies, filter by userId if provided
const companiesQuery = supabase
  .from('companies')
  .select('id, user_id, logo_url')
  .not('logo_url', 'is', null);

if (userId) {
  companiesQuery.eq('user_id', userId);
}

const { data: companies } = await companiesQuery;

// Same pattern for documents and reminders queries
```

### Changes Summary

1. **Parse `userId` from request body** (optional parameter)
2. **Filter companies query** by `user_id` when provided
3. **Filter documents query** - join with companies and filter by `user_id`
4. **Filter reminders query** - join with companies and filter by `user_id`
5. **Log which user is being migrated** for clarity

### Usage

```javascript
// Test single user migration (dry run first)
supabase.functions.invoke('storage-migrate', {
  body: { 
    dryRun: true, 
    userId: 'fabec19c-425d-4d41-b6b1-f84c58cb3a95' 
  }
})

// Execute single user migration
supabase.functions.invoke('storage-migrate', {
  body: { 
    dryRun: false, 
    userId: 'fabec19c-425d-4d41-b6b1-f84c58cb3a95' 
  }
})
```

### Expected Result

After migration:
- Document will be uploaded to DO Spaces at new path
- Database `documents.file_path` will be updated
- Original file in Supabase Storage remains (backup)
- Frontend will load from DO Spaces via signed URL

### Verification Steps

1. Run dry run to confirm 1 file detected
2. Execute migration
3. Check DO Spaces for uploaded file
4. Load documents page as that user - verify file downloads correctly

