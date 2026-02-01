
Cilj: (1) korisnik posle registracije ne sme biti prebačen na /dashboard niti videti ulogovano stanje, (2) brisanje korisnika iz Admin panela mora ponovo da radi.

## 1) Zašto se i dalje “automatski uloguje” posle registracije
U `src/App.tsx` ruta `/auth` je definisana ovako:

- Ako `user` postoji → automatski radi `<Navigate to="/dashboard" />`

To se desi čim backend kreira sesiju zbog auto-confirm-a (pre nego što tvoj `handleSignUp` stigne da odradi `signOut()`), pa React Router odmah prebacuje na `/dashboard`. To je “flash / auto login”.

### Rešenje
Promeniti logiku `/auth` rute tako da ne preusmerava na `/dashboard` samo zato što `user` postoji, već samo ako je:
- admin, ili
- `isEmailVerified === true`, i
- nije recovery flow

Time `/auth` ostaje stabilna stranica koja uvek može da prikaže “Potvrdite email” stanje bez ikakvog prebacivanja.

## 2) Konkretne izmene (frontend)

### 2.1 `src/App.tsx` – popravka `/auth` rute (kritično)
Umesto:
- `element={user && !isRecoveryUrl ? <Navigate .../> : <Auth />}`

Uraditi:
- u `AppRoutes()` uzeti iz `useAuth()` i `isAdmin` i `isEmailVerified`
- računati `canEnterApp = user && (isAdmin || isEmailVerified)`
- `/auth` preusmeri na `/dashboard` samo ako `canEnterApp && !isRecoveryUrl`, inače uvek renderuje `<Auth />`

Ovo direktno uklanja auto-redirect posle registracije, čak i ako sesija kratko nastane.

### 2.2 `src/pages/Auth.tsx` – zadržati postojeći “anti-flash” kod
Tvoj trenutni mehanizam (`isRegistering`, `showEmailVerificationMessage`, `await supabase.auth.signOut()` odmah posle signup-a) je dobar i treba da ostane, ali tek kada se ukloni gornji “router-level” redirect, stvarno će raditi.

Dodatno (mali hardening):
- U `handleSignUp` u `honeypot` grani obavezno vratiti `setIsRegistering(false)` (da ne ostane zaključano stanje ako bot polje bude popunjeno).
- U `handleSignUp` u svim early-return greškama (PIB validation fail, disposable email, validateForm fail) obavezno vratiti `setIsRegistering(false)` pre `return` (trenutno se setuje `true` na početku; u nekim granama se vraća bez resetovanja).

(To nije direktno razlog “auto login” buga, ali sprečava sporedne UI bugove.)

## 3) Zašto “Delete user” sada puca
U logovima backend funkcije `delete-user` vidi se:
- `AuthSessionMissingError: Auth session missing!` u pozivu `supabaseAuth.auth.getClaims(token)`

U Deno edge runtime-u nema “session storage” kao u browseru, i `getClaims(token)` u praksi ume da pokuša da koristi internu sesiju i padne sa “session missing”, iako token postoji u headeru.

### Rešenje (backend funkcija)
U `supabase/functions/delete-user/index.ts` zameniti verifikaciju ovako:

1) Pročitati `Authorization` header i izvući token (kao i sada).
2) Kreirati “anon” client sa `global.headers.Authorization = authHeader` i sa isključenim session feature-ima:
   - `auth: { persistSession: false, autoRefreshToken: false }`
3) Umesto `getClaims(token)` koristiti:
   - `const { data: userData, error } = await supabaseAuth.auth.getUser(token)`
4) Ako je OK:
   - `currentUserId = userData.user.id`
5) Nastaviti postojeću proveru admin role preko service-role klijenta i brisanje preko Admin API.

Ovo uklanja zavisnost od “session” i radi pouzdano u edge okruženju.

## 4) Provera posle izmena (acceptance)
1) Registracija novog korisnika:
   - Ostaje na `/auth`
   - Prikazuje se “Potvrdite email adresu”
   - Ne prebacuje na `/dashboard` ni na trenutak
2) Pokušaj logina sa neverifikovanim korisnikom:
   - Odmah ga odjavi + toast poruka (kao sada)
3) Admin panel → “Obriši korisnika”:
   - Ne dobija “Edge Function returned a non-2xx”
   - Korisnik se briše i lista se refresuje

## 5) Fajlovi koji će se menjati
- `src/App.tsx` (kritično: promena uslova za `/auth` redirect)
- `src/pages/Auth.tsx` (hardening: reset `isRegistering` u early-return granama)
- `supabase/functions/delete-user/index.ts` (kritično: auth validacija preko `getUser(token)` umesto `getClaims(token)`)

## 6) Napomena o adminu i trenutnom stanju (/admin)
Pošto si trenutno na `/admin`, “Edge Function returned a non-2xx status code” toast koji vidiš je kompatibilan sa ovim uzrokom: `delete-user` funkcija sada puca na auth verifikaciji (session missing), pa vraća 401/500 i UI prikazuje grešku.
