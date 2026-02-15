

# Kreiranje novog korisnika sa super_admin i admin ulogom

## Sta se radi

Kreiranje novog korisnickog naloga koji ce imati:
- **super_admin** ulogu (globalna, za platformski pristup)
- **admin** ulogu na **AI IT Development** tenanu (za pristup demo podacima)
- Clanstvo u tenant_members sa statusom "active"

## Implementacija

### Nova Edge Function: `create-admin-user`

Jednostavna edge funkcija koja koristi `supabase.auth.admin.createUser` sa service role key-em da kreira novog korisnika i dodeli mu uloge.

Funkcija ce:
1. Kreirati auth korisnika sa email/password
2. Sacekati da `handle_new_user` trigger kreira profil
3. Azurirati `profiles.full_name`
4. Insertovati `user_roles` zapise: `super_admin`, `admin`, `user`
5. Insertovati `tenant_members` zapis za AI IT Development tenant

### Kredencijali novog korisnika

| Polje | Vrednost |
|---|---|
| Email | lovable@aiitdevelopment.com |
| Password | Lovable2026! |
| Full Name | Lovable Assistant |
| Roles | super_admin, admin, user |
| Tenant | AI IT Development (admin) |

### Fajlovi

| Fajl | Akcija |
|---|---|
| `supabase/functions/create-admin-user/index.ts` | Novi - jednokratna funkcija za kreiranje korisnika |

Posle kreiranja, funkcija se moze obrisati jer je jednokratna.
