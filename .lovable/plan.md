
# Plan: Full Storage Migration to DigitalOcean Spaces

## Status Check

**Companies.tsx upload already fixed!**
- Line 9: `import { uploadFile } from '@/lib/storage';`
- Lines 191-196: Uses `uploadFile({ type: 'logo', companyId, file })`
- No changes needed - already routing to DigitalOcean Spaces

## Migration Execution

Run full migration for all remaining files:

### Step 1: Dry Run (preview what will be migrated)
```javascript
supabase.functions.invoke('storage-migrate', {
  body: { dryRun: true }
})
```

### Step 2: Execute Full Migration
```javascript
supabase.functions.invoke('storage-migrate', {
  body: { dryRun: false }
})
```

### Expected Files to Migrate

| Type | Remaining Files | Status |
|------|----------------|--------|
| Company Logos | ~5 | Pending |
| Documents | ~13 | Pending |
| Reminder Attachments | ~14 | Pending |
| **Total** | ~32 | To migrate |

### What Happens During Migration

1. **Download** each file from Supabase Storage bucket
2. **Upload** to DigitalOcean Spaces with new path structure:
   - Logos: `users/{userId}/logos/{companyId}/{timestamp}_{filename}`
   - Documents: `users/{userId}/documents/{companyId}/{folder}/{timestamp}_{filename}`
   - Reminders: `users/{userId}/reminders/{companyId}/{timestamp}_{filename}`
3. **Update database** record with new path/URL
4. **Original files remain** in Supabase (backup)

### Verification After Migration

- Check DO Spaces console for uploaded files
- Test download functionality via app
- Confirm database records updated correctly
