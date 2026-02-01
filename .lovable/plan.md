
# Plan: Sprečiti UX flash pri registraciji

## Problem

Trenutno, kada se korisnik registruje:
1. Supabase kreira nalog sa auto-confirm (potrebno za custom verifikaciju)
2. Supabase automatski kreira sesiju (korisnik je tehnički "ulogovan")
3. `useEffect` u Auth.tsx detektuje `user` i preusmeri na `/dashboard`
4. Korisnik na kratko vidi dashboard pre nego što se prikaže poruka o verifikaciji

## Rešenje

Sprečiti bilo kakav "flash" ulogovanog stanja tako što ćemo:
1. Dodati flag koji označava da je registracija u toku
2. Sprečiti redirect na dashboard dok se registracija ne završi
3. Odmah odjaviti korisnika nakon uspešne registracije (pre nego što React može da reaguje)
4. Blokirati login za neverifikovane korisnike

## Promene u kodu

### 1. `src/pages/Auth.tsx` - Dodaj `isRegistering` flag

Dodati state koji označava da je registracija u toku:

```typescript
const [isRegistering, setIsRegistering] = useState(false);
```

### 2. `src/pages/Auth.tsx` - Blokiraj auto-redirect tokom registracije

Izmeniti `useEffect` za redirect da ignoriše `user` tokom registracije:

```typescript
useEffect(() => {
  // NE preusmeri ako je registracija u toku ili ako se prikazuje verifikaciona poruka
  if (isRegistering || showEmailVerificationMessage) {
    return;
  }
  if (user && mode !== 'reset-password' && !isRecovery) {
    navigate('/dashboard', { replace: true });
  }
}, [user, mode, isRecovery, navigate, isRegistering, showEmailVerificationMessage]);
```

### 3. `src/pages/Auth.tsx` - handleSignUp: Odjavi korisnika ODMAH

Izmeniti `handleSignUp` funkciju da postavi `isRegistering` flag i odjavi korisnika pre bilo kakvog UI update-a:

```typescript
const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);
  setIsRegistering(true);  // NOVO: Spreči auto-redirect
  setErrors({});
  
  // ... postojeća validacija i signUp poziv ...
  
  if (data.user) {
    // NOVO: ODMAH odjavi korisnika pre bilo čega drugog
    await supabase.auth.signOut();
    
    try {
      // Sada pošalji verifikacioni email (korisnik više nije ulogovan)
      const { error: verificationError } = await supabase.functions.invoke('send-verification-email', {...});
      // ... postojeći kod za handling emaila ...
    } catch (err) {
      // ... postojeći error handling ...
    }
    
    setRegisteredUserData({ userId: data.user.id, email, fullName });
    setShowEmailVerificationMessage(true);
  }
  
  setIsRegistering(false);  // NOVO: Završena registracija
  setLoading(false);
};
```

### 4. `src/pages/Auth.tsx` - handleSignIn: Blokiraj login za neverifikovane

Izmeniti `handleSignIn` da proveri `email_verified` i odjavi neverifikovane korisnike:

```typescript
const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
  // ... postojeća validacija ...
  
  const { error } = await signIn(email, password);
  
  if (error) {
    // ... postojeći error handling ...
    return;
  }
  
  // NOVO: Proveri email_verified iz profiles tabele
  const { data: { user: loggedInUser } } = await supabase.auth.getUser();
  
  if (loggedInUser) {
    // Proveri da li je admin (admini mogu uvek)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', loggedInUser.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    const isUserAdmin = !!roleData;
    
    if (!isUserAdmin) {
      // Proveri email_verified
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('id', loggedInUser.id)
        .single();
      
      if (!profileData?.email_verified) {
        // Odjavi korisnika i prikaži poruku
        await supabase.auth.signOut();
        toast({
          title: 'Potvrdite email adresu',
          description: 'Morate potvrditi email adresu pre prijave. Proverite inbox za link.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
    }
  }
  
  // Weak password check ostaje
  if (isWeakPassword(password)) {
    toast({...});
  }
  
  navigate('/dashboard');
  setLoading(false);
};
```

### 5. `src/App.tsx` - ProtectedRoute backup zaštita

Dodati proveru `isEmailVerified` kao backup sloj zaštite:

```typescript
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin, isEmailVerified } = useAuth();

  if (loading) {
    return <div>Učitavanje...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // NOVO: Blokiraj neverifikovane (osim admina)
  if (!isAdmin && !isEmailVerified) {
    return <Navigate to="/auth" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <CompanyProvider>
      <AppLayout>{children}</AppLayout>
    </CompanyProvider>
  );
}
```

## Tok korisničkog iskustva posle izmena

```text
REGISTRACIJA:
1. Korisnik popuni formu i klikne "Registruj se"
2. Sistem kreira nalog (auto-confirm)
3. isRegistering = true sprečava bilo kakav redirect
4. Sistem ODMAH poziva signOut() - korisnik više nije ulogovan
5. Sistem šalje verifikacioni email
6. Korisnik vidi poruku "Potvrdite email adresu" - NIKADA ne vidi dashboard

LOGIN (neverifikovan korisnik):
1. Korisnik unese kredencijale
2. Supabase uspešno loguje korisnika
3. Provera email_verified u profiles tabeli
4. Ako nije verifikovan i nije admin -> signOut() + poruka o verifikaciji
5. Korisnik NIKADA ne vidi dashboard

LOGIN (verifikovan korisnik):
1. Normalan login tok
```

## Fajlovi za izmenu

| Fajl | Izmene |
|------|--------|
| `src/pages/Auth.tsx` | Dodaj `isRegistering` state, blokiraj redirect, signOut nakon signup, provera email_verified pri login |
| `src/App.tsx` | ProtectedRoute proverava `isEmailVerified` kao backup |
