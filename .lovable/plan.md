
# Plan: Linkovi za direktno plaćanje nakon registracije

## Opis
Kreiranje linkova na landing stranici koji vode korisnika direktno na stranicu za plaćanje u profilu nakon uspešne registracije, sa automatski selektovanim planom.

## Tok korisnika

```text
┌─────────────────────────────────────────────────────────────────┐
│ Landing Page (Index.tsx)                                        │
│   "Započni besplatno" →  /auth?plan=1  (mesečni)               │
│   "Započni besplatno" →  /auth?plan=6  (polugodišnji)          │
│   "Započni besplatno" →  /auth?plan=12 (godišnji)              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Auth Page (Auth.tsx)                                            │
│   - Čuva "plan" parametar u localStorage pre registracije       │
│   - Nakon uspešne registracije:                                 │
│       ako plan postoji → redirect na /profile?plan=X            │
│       inače → redirect na /dashboard                            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Profile Page (Profile.tsx)                                      │
│   - Čita "plan" query parametar                                 │
│   - Automatski otvara "Pretplata" tab                           │
│   - Auto-selektuje odgovarajući plan (1/6/12 meseci)            │
│   - Prikazuje QR kod za plaćanje                                │
└─────────────────────────────────────────────────────────────────┘
```

## Tehničke izmene

### 1. `src/pages/Index.tsx` - Izmena pricing linkova

Ažurirati linkove u pricing kartama da sadrže `plan` query parametar:

```typescript
// Umesto:
<Link to="/auth">Započni besplatno</Link>

// Novo - sa parametrom za broj meseci:
// Mesečni plan:
<Link to="/auth?plan=1">Započni besplatno</Link>

// Polugodišnji plan:
<Link to="/auth?plan=6">Započni besplatno</Link>

// Godišnji plan:
<Link to="/auth?plan=12">Započni besplatno</Link>
```

Potrebno je mapirati index plana na broj meseci:
- Index 0 (Mesečni) → `plan=1`
- Index 1 (Polugodišnji) → `plan=6`
- Index 2 (Godišnji) → `plan=12`

### 2. `src/pages/Auth.tsx` - Čuvanje plana i redirect

**A) Čitanje i čuvanje plan parametra:**
```typescript
// Pored postojećih searchParams:
const planParam = searchParams.get('plan');

// Čuvanje u localStorage kad korisnik otvori stranicu:
useEffect(() => {
  if (planParam) {
    localStorage.setItem('pendingPlan', planParam);
  }
}, [planParam]);
```

**B) Izmena handleSignUp funkcije:**
```typescript
// Umesto:
navigate('/dashboard');

// Novo:
const pendingPlan = localStorage.getItem('pendingPlan');
if (pendingPlan) {
  localStorage.removeItem('pendingPlan');
  navigate(`/profile?plan=${pendingPlan}&tab=subscription`);
} else {
  navigate('/dashboard');
}
```

### 3. `src/pages/Profile.tsx` - Automatski odabir plana

**A) Čitanje query parametara:**
```typescript
import { useSearchParams } from 'react-router-dom';

// Na početku komponente:
const [searchParams, setSearchParams] = useSearchParams();
const planFromUrl = searchParams.get('plan');
const tabFromUrl = searchParams.get('tab');
```

**B) Automatski odabir taba:**
```typescript
// Izmena defaultValue za Tabs komponentu:
// Umesto hardkodiranog 'subscription':
defaultValue={tabFromUrl === 'subscription' ? 'subscription' : 'subscription'}

// Ili koristiti state:
const [activeTab, setActiveTab] = useState(
  tabFromUrl || 'subscription'
);
```

**C) Auto-selekcija plana na mount:**
```typescript
useEffect(() => {
  if (planFromUrl) {
    const planMap: Record<string, string> = {
      '1': 'monthly',
      '6': 'semiannual',
      '12': 'annual'
    };
    const planKey = planMap[planFromUrl];
    if (planKey) {
      setSelectedPlan(planKey);
    }
    // Očisti URL parametre
    setSearchParams({}, { replace: true });
  }
}, [planFromUrl]);
```

## Fajlovi za izmenu

| Fajl | Izmena |
|------|--------|
| `src/pages/Index.tsx` | Dodati `?plan=X` na pricing dugmiće |
| `src/pages/Auth.tsx` | Čuvanje plan parametra, redirect na /profile nakon registracije |
| `src/pages/Profile.tsx` | Čitanje plan parametra, auto-selekcija plana |

## Napomene

- Plan parametar se čuva u localStorage jer se gubi tokom auth procesa (Supabase redirecti)
- URL parametri se čiste nakon primene da URL ostane čist
- Postojeći korisnici (login) neće biti redirektovani na profil jer plan ima smisla samo za nove registracije
