

# Plan: Zabrana pristupa aplikaciji nakon isteka pretplate

## Opis rešenja

Korisnici kojima je istekla pretplata (trial ili plaćena) će moći da pristupe **samo stranici Profila** (`/profile`) gde vide uputstva za plaćanje i QR kod. Sve ostale rute će ih automatski preusmeriti na Profil.

**Izuzeci od zabrane:**
- Admini - uvek imaju pun pristup
- Knjigovođe - imaju besplatan pristup (već implementirano)

---

## Tehnički detalji

### 1. Proširenje `ProtectedRoute` komponente

**Fajl:** `src/App.tsx`

Dodajem novu prop `allowExpired` i logiku za proveru isteka pretplate:

```typescript
function ProtectedRoute({ 
  children, 
  adminOnly = false,
  allowExpired = false  // Nova prop
}: { 
  children: React.ReactNode; 
  adminOnly?: boolean;
  allowExpired?: boolean;
}) {
  const { 
    user, loading, profileLoading, isAdmin, 
    isEmailVerified, isSubscriptionExpired, isBookkeeper 
  } = useAuth();

  // ... postojeći loading i auth checkovi ...

  // NOVO: Ako pretplata istekla i ruta ne dozvoljava expired, redirect na /profile
  if (isSubscriptionExpired && !isAdmin && !isBookkeeper && !allowExpired) {
    return <Navigate to="/profile" replace />;
  }

  // ... ostatak komponente ...
}
```

### 2. Markiranje `/profile` rute kao dozvoljene

Samo Profil ruta dobija `allowExpired={true}`:

```typescript
<Route 
  path="/profile" 
  element={
    <ProtectedRoute allowExpired>
      <Profile />
    </ProtectedRoute>
  } 
/>
```

### 3. Prikaz obaveštenja na Profilu

Već postoji upozorenje za istekle pretplate na stranici Profila (linije 411-420). Može se dodatno istaći sa jasnijom porukom:

```text
"Vaša pretplata je istekla. Pristup aplikaciji je ograničen.
Produžite pretplatu da biste nastavili sa korišćenjem svih funkcija."
```

---

## Tok korisnika nakon isteka

```text
1. Korisnik se loguje
2. Sistem proverava subscription_end datum
3. Ako je istekao:
   - Bilo koja ruta → Redirect na /profile
   - Korisnik vidi poruku o isteku + QR kod za plaćanje
4. Kada admin aktivira pretplatu → Korisnik dobija pun pristup
```

---

## Prednosti ovog pristupa

- Jednostavna implementacija - samo jedna tačka kontrole
- Korisnik i dalje može da se odjavi (logout je deo navigacije)
- Jasna poruka i uputstva za plaćanje odmah vidljivi
- Admini mogu i dalje pristupiti admin panelu
- Knjigovođe nisu pogođene (besplatan pristup)

