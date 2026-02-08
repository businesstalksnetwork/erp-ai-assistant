

# Plan: Dodavanje "Istekao Trial" kartice u Admin Panel

## Trenutno stanje

Admin Panel prikazuje 4 statisticke kartice u grid-u 2x2 (mobilni) / 4 kolone (desktop):
1. **Aktivni** -- placeni korisnici sa aktivnom pretplatom
2. **Trial** -- korisnici na aktivnom trial periodu
3. **Promo** -- korisnici registrovani preko partnera
4. **Istekli** -- svi korisnici kojima je pretplata istekla (i trial i placeni zajedno)

## Izmena

Dodaje se nova kartica **"Istekao Trial"** koja prikazuje korisnike kojima je trial period istekao (a nisu presli na placenu pretplatu). Postojeca kartica "Istekli" ce prikazivati samo istekle PLACENE korisnike.

### Rezultat: 5 kartica

| Aktivni | Trial | Istekao Trial | Promo | Istekli |
|---------|-------|---------------|-------|---------|
| Placeni aktivni | Aktivni trial | Istekao trial | Preko partnera | Istekli placeni |

## Tehnicki detalji

Fajl: `src/pages/AdminPanel.tsx`

### 1. Dodati novi filter tip
```text
type FilterType = 'all' | 'active' | 'trial' | 'expired_trial' | 'promo' | 'expired';
```

### 2. Izracunati novu statistiku
```text
const expiredTrialCount = pausalUsers.filter(u => 
  u.is_trial && getSubscriptionInfo(u).daysLeft < 0 && u.status !== 'rejected'
).length;
```

### 3. Azurirati filter logiku za expired_trial i suziti existing expired
```text
case 'expired_trial':
  return u.is_trial && subInfo.daysLeft < 0 && u.status !== 'rejected';
case 'expired':
  return !u.is_trial && subInfo.daysLeft < 0 && u.status !== 'rejected';
```

### 4. Dodati novu karticu u grid
Nova kartica "Istekao Trial" sa `AlertTriangle` ili `Clock` ikonom u narandzastoj boji, pozicionirana izmedju Trial i Promo kartica.

### 5. Prilagoditi grid raspored za 5 kartica
```text
grid-cols-2 md:grid-cols-3 lg:grid-cols-5
```

