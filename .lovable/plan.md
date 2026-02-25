

# Create Tenant: BCILITY DOO Čačak

## What Will Be Done

Create a new tenant "BCILITY DOO" based in Čačak with bogdan@aiitdevelopment.com as the admin user, using the existing `create-tenant` edge function.

## Steps

### 1. Call the `create-tenant` Edge Function
The existing edge function handles the full provisioning flow:
- Creates the tenant record (name: "BCILITY DOO", slug: "bcility-doo", plan: professional, status: trial)
- Creates the legal entity (city: Čačak, country: RS)
- Creates the auth user for bogdan@aiitdevelopment.com with a secure password
- Assigns admin role and tenant membership
- Seeds modules based on the "professional" plan (accounting, sales, inventory, hr, crm)

### 2. Authentication Requirement
You need to be logged in as the super admin (aleksandar@aiitdevelopment.com) in the preview for the edge function call to succeed, since it verifies super admin privileges. Please log in first, then approve this plan.

### Technical Details
- Edge function: `create-tenant` (already deployed)
- Tenant plan: `professional`
- Admin user password will be set to a secure default (you can share it with Bogdan or he can use "Forgot password")
- The function automatically handles: profile creation, role assignment, tenant membership, and module seeding

