
## Problem

Postojeci korisnik (pbcconsulting021) ima `email_verified: true` u bazi, ali kada se prijavi:
1. Login uspe i poziva se `navigate('/dashboard')`
2. Ali `ProtectedRoute` u `App.tsx` blokira pristup jer `isEmailVerified` iz `useAuth()` jos uvek nije ucitan (profil se asinhrono ucitava)
3. Korisnik se vraca na `/auth` i vidi beli ekran jer se ne prikazuje nista dok se ne ucita profil

## Uzrok

Race condition: `profile` podaci se ucitavaju asinhrono u `AuthProvider`, a `isEmailVerified` je `false` dok se profil ne ucita. Tokom tog vremena, `canEnterApp = user && (isAdmin || isEmailVerified)` je `false` cak i za verifikovane korisnike.

## Resenje

### 1. `src/lib/auth.tsx` - Blokirati navigaciju dok se profil ne ucita

Dodati `profileLoading` state koji ce biti `true` dok se profil ucitava. Kombinovati sa postojecim `loading` stateom tako da aplikacija ne donosi odluke o rutiranju dok profil nije ucitan.

```typescript
// Postojece stanje
const [profile, setProfile] = useState<Profile | null>(null);
const [loading, setLoading] = useState(true);

// NOVO: profileLoading - odvojeno od auth loading
const [profileLoading, setProfileLoading] = useState(false);

const fetchProfile = async (userId: string) => {
  setProfileLoading(true); // NOVO
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  // ... postavi profile ...
  setProfileLoading(false); // NOVO
};

// Kombinovani loading za export
const isFullyLoaded = !loading && !profileLoading;
```

### 2. `src/App.tsx` - Sacekati dok se profil ucita

Promeniti logiku tako da:
- Dok je `loading` ili `profileLoading`, prikazati loading state
- Tek nakon ucitavanja profila donositi odluku o `canEnterApp`

```typescript
function ProtectedRoute({ children }) {
  const { user, loading, isAdmin, isEmailVerified, profileLoading } = useAuth();

  // Sacekaj oba: auth i profile loading
  if (loading || profileLoading) {
    return <div className="min-h-screen flex items-center justify-center">Ucitavanje...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Sada mozemo pouzdano proveriti email_verified
  if (!isAdmin && !isEmailVerified) {
    return <Navigate to="/auth" replace />;
  }
  // ...
}

function AppRoutes() {
  const { user, loading, isAdmin, isEmailVerified, profileLoading } = useAuth();
  
  if (loading || profileLoading) {
    return <div className="min-h-screen flex items-center justify-center">Ucitavanje...</div>;
  }
  
  const canEnterApp = user && (isAdmin || isEmailVerified);
  // ...
}
```

### 3. `src/pages/Auth.tsx` - Ukloniti redundantnu navigaciju u useEffect

Posto `App.tsx` sada pravilno hendluje rutiranje, `useEffect` koji poziva `navigate('/dashboard')` kada postoji `user` nije vise potreban i moze izazvati race condition. Ukloniti taj useEffect ili ga uciniti bezopasnim.

```typescript
// UKLONITI ovaj useEffect jer App.tsx sada hendluje rutiranje
// useEffect(() => {
//   if (isRegistering || showEmailVerificationMessage) return;
//   if (user && mode !== 'reset-password' && !isRecovery) {
//     navigate('/dashboard', { replace: true });
//   }
// }, [user, mode, isRecovery, navigate, isRegistering, showEmailVerificationMessage]);
```

## Fajlovi koji ce se menjati

1. `src/lib/auth.tsx` - Dodati `profileLoading` state i exportovati ga
2. `src/App.tsx` - Koristiti `profileLoading` u loading uslovima
3. `src/pages/Auth.tsx` - Ukloniti problematican useEffect

## Ocekivani rezultat

1. Postojeci verifikovani korisnici (kao pbcconsulting021) ce se prijaviti i odmah videti dashboard bez belog ekrana
2. Novi korisnici ce ostati na `/auth` stranici i videti poruku za verifikaciju
3. Nema vise race condition izmedju ucitavanja profila i rutiranja
