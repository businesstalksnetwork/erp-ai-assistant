
# Create Uniprom Organization + .bak File Assessment

## Task 1: Create Uniprom Tenant

The `create-tenant` edge function is already built and handles the full setup flow. I will call it directly from the Supabase dashboard or via the curl tool to create the organization with the following data:

- **Tenant name:** Uniprom
- **Slug:** uniprom
- **Plan:** enterprise (can be adjusted)
- **Admin email:** bogdan.ciric023@gmail.com
- **Admin password:** Uniprom2024!
- **Legal entity:** Uniprom

The function will automatically:
1. Create the tenant row
2. Create a legal entity record
3. Create the auth user with email confirmed
4. Create profile + assign admin role
5. Add tenant membership
6. Enable all modules based on plan

This requires no code changes -- just calling the edge function as super-admin.

## Task 2: .bak File

A `.bak` file is a **Microsoft SQL Server binary backup**. It is a proprietary binary format that cannot be opened as a text file or parsed by standard tools.

**What we CAN try:**
- Use the document parser tool to inspect the file after you upload it -- it will attempt OCR and text extraction
- Extract any readable text strings (table names, column names, data fragments) from the binary content
- Use those fragments to understand the data schema and map it to the ERP structure

**Limitations:**
- Without SQL Server to restore the backup, we cannot get clean structured data
- The file needs to be under 20MB to upload here
- If it's larger, you would need to restore it to a SQL Server instance, export as CSV or SQL dump, and upload those instead

**Recommended approach if .bak is too large or unreadable:**
1. Restore it on a SQL Server instance (or use Azure Data Studio / SSMS)
2. Export each table as CSV
3. Upload the CSVs here and I can map/import the data into Supabase

**Next step:** Please upload the .bak file (max 20MB) and I'll attempt to inspect it.

## Technical Summary

- No code changes needed for tenant creation -- pure data operation via the existing edge function
- The .bak inspection will be attempted after file upload
- If the .bak contains recognizable ERP data (customers, products, invoices), I can build an import migration to load it into the correct Supabase tables
