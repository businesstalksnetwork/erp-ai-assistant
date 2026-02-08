
# Plan: Uključiti korisnike sa "Trial: 0d" i dodati opciju slanja emaila

## Deo 1: Proširiti filter "Istekao Trial"

Trenutno filter "Istekao Trial" prikazuje samo korisnike kojima je trial istekao (`daysLeft < 0`). Korisnici na poslednjem danu triala (`Trial: 0d`) se i dalje prikazuju u kategoriji "Trial".

### Izmena:
- Promeniti uslov sa `daysLeft < 0` na `daysLeft <= 0` u filteru, statistici i kartici
- Ovo uključuje korisnike kojima trial ističe danas (0 dana ostalo)
- Filter "Trial" se sužava na `daysLeft > 0` (samo oni koji imaju bar 1 dan)

## Deo 2: Dugme "Pošalji mail" za istekle trial korisnike

Kada je aktivan filter "Istekao Trial", prikazaće se dugme "Pošalji mail svima" iznad tabele korisnika. Klikom na dugme otvara se potvrda sa brojem korisnika kojima će mail biti poslat.

### Kako funkcioniše:

1. Dugme se prikazuje samo kada je aktivan filter `expired_trial`
2. Klik otvara AlertDialog sa potvrdom: "Poslati email na X korisnika?"
3. Nakon potvrde, poziva se nova edge funkcija koja šalje email svakom korisniku
4. Prikazuje se toast sa rezultatom (koliko je emailova uspešno poslato)

## Deo 3: Nova edge funkcija `send-admin-bulk-email`

Edge funkcija prima listu email adresa i šalje personalizovan email svakom korisniku. Email koristi template iz `email_templates` tabele (ključ: `trial_expired_admin`), ili ako template ne postoji, koristi ugrađen default tekst.

### Email sadržaj (default):
- Naslov: "Vaš probni period na PausalBox-u je istekao"
- Poruka: Obaveštava korisnika da je trial istekao i poziva ga da aktivira pretplatu

## Deo 4: Email template u bazi

Dodaje se novi red u `email_templates` tabelu sa ključem `trial_expired_admin` koji admin može naknadno urediti kroz postojeći Email tab.

## Tehnički detalji

### Fajl: `src/pages/AdminPanel.tsx`

**Izmena filtera i statistike:**
```text
// Statistika - menjamo < 0 u <= 0
const expiredTrialCount = pausalUsers.filter(u => 
  u.is_trial && getSubscriptionInfo(u).daysLeft <= 0 && u.status !== 'rejected'
).length;

// Filter - menjamo < 0 u <= 0
case 'expired_trial':
  return user.is_trial && subInfo.daysLeft <= 0 && user.status !== 'rejected';

// Trial filter se sužava na > 0
case 'trial':
  return user.is_trial && user.status !== 'rejected' && subInfo.daysLeft > 0;

// Trial count - takodje > 0
const trialCount = pausalUsers.filter(u => 
  u.is_trial && u.status !== 'rejected' && getSubscriptionInfo(u).daysLeft > 0
).length;
```

**Novi state i dugme:**
```text
const [isSendingBulkEmail, setIsSendingBulkEmail] = useState(false);
const [bulkEmailConfirmOpen, setBulkEmailConfirmOpen] = useState(false);

// Dugme se prikazuje u headeru kartice korisnika kada je filter = expired_trial
{filter === 'expired_trial' && filteredUsers.length > 0 && (
  <Button onClick={() => setBulkEmailConfirmOpen(true)} size="sm">
    <Mail className="h-4 w-4 mr-2" />
    Pošalji mail svima ({filteredUsers.length})
  </Button>
)}
```

**Potvrda i slanje:**
```text
// AlertDialog za potvrdu
// Po potvrdi poziva edge funkciju sa listom emailova
const handleBulkEmail = async () => {
  const emails = filteredUsers.map(u => ({ 
    email: u.email, 
    full_name: u.full_name 
  }));
  await supabase.functions.invoke('send-admin-bulk-email', {
    body: { recipients: emails, templateKey: 'trial_expired_admin' }
  });
};
```

### Novi fajl: `supabase/functions/send-admin-bulk-email/index.ts`

Edge funkcija koja:
1. Prima listu primaoca (`recipients`) i ključ šablona (`templateKey`)
2. Učitava šablon iz `email_templates` tabele
3. Ako šablon ne postoji, koristi ugrađen default
4. Šalje email svakom primaocu putem Resend API-ja
5. Loguje svako slanje u `email_notification_log`
6. Vraća rezultat: koliko je poslato, koliko je grešaka

### Migracija baze: novi email template

```text
INSERT INTO email_templates (template_key, subject, html_content)
VALUES (
  'trial_expired_admin',
  'Vaš probni period na PausalBox-u je istekao',
  '<html>...</html>'  -- HTML sa pozivom na aktivaciju pretplate
)
ON CONFLICT (template_key) DO NOTHING;
```

## Očekivano ponašanje

1. Kartica "Istekao Trial" sada uključuje i korisnike sa "Trial: 0d"
2. Klik na karticu filtrira listu
3. Pojavljuje se dugme "Pošalji mail svima (X)"
4. Klik na dugme otvara potvrdu
5. Nakon potvrde, šalju se emailovi svim filtriranim korisnicima
6. Toast prikazuje rezultat slanja
7. Admin može urediti tekst emaila kroz Email tab
