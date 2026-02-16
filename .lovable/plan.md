

# Plan: In-app notifikacije iz edge funkcije + Push notifikacije + Settings UI

## Pregled

Tri povezane stvari:
1. Edge funkcija `send-notification-emails` treba da kreira i in-app notifikacije (u `notifications` tabeli) pored email-ova
2. Izgraditi potpun push notification sistem (browser Push API + Service Worker)
3. Dodati nove sekcije u Settings tab: "App notifikacije" i "Push notifikacije"

---

## Deo 1: In-app notifikacije iz edge funkcije

### Izmena: `supabase/functions/send-notification-emails/index.ts`

Dodati helper `insertNotification` i pozvati ga na tri mesta:

**a) Podsetnici** (posle uspesnog email slanja, linija 86):
- Tip: `reminder_due`
- Naslov: `Podsetnik: {title}`
- Poruka: `Rok: {due_date}` + iznos ako postoji
- Link: `/reminders`
- reference_id: reminder ID

**b) Pretplata/trial** (posle logNotification, linija 109):
- Tip: `subscription_expiring`
- Naslov: `Pretplata istice za {d} dana` / `Trial istice za {d} dana`
- Poruka: `Vasa pretplata istice {date}`
- Link: `/profile`

**c) Limiti** (posle logNotification, linija 135):
- Tip: `limit_warning`
- Naslov: `Upozorenje: Limit {percent}%`
- Poruka: `Dostigli ste {percent}% limita od 6M. Preostalo: {remaining}`
- Link: `/dashboard`

### Izmena: `src/components/NotificationBell.tsx`

Dodati ikone za nove tipove:
- `reminder_due` - Clock ikona (narandzasta)
- `subscription_expiring` - AlertTriangle ikona (crvena)
- `limit_warning` - TrendingUp ikona (zuta)

---

## Deo 2: Push Notification sistem

### Kako funkcionise
- Browser Push API omogucava slanje notifikacija cak i kada aplikacija nije otvorena
- Korisnik odobri dozvolu u browseru
- Browser generise "push subscription" (endpoint + keys)
- Subscription se cuva u bazi
- Edge funkcija salje push notifikaciju preko Web Push protokola

### Baza podataka - nova tabela `push_subscriptions`
- `id` (UUID, PK)
- `user_id` (UUID, NOT NULL)
- `endpoint` (TEXT, NOT NULL) - browser push endpoint
- `p256dh` (TEXT, NOT NULL) - public key
- `auth` (TEXT, NOT NULL) - auth secret
- `created_at` (TIMESTAMPTZ)

RLS: korisnici mogu citati/brisati/kreirati svoje subscriptions (`user_id = auth.uid()`)

### Profil tabela - nova kolona
- `push_notifications_enabled` (BOOLEAN, default false) - da li korisnik zeli push notifikacije

### VAPID kljucevi
Push notifikacije zahtevaju VAPID (Voluntary Application Server Identification) kljuceve. Generisacemo par kljuceva:
- Javni kljuc (VAPID public key) - koristi se u frontendu za subscribe
- Privatni kljuc (VAPID private key) - cuva se kao secret u edge funkcijama

### Service Worker: `public/sw.js`
- Minimalan service worker koji slusa `push` event i prikazuje notifikaciju
- Slusa `notificationclick` event za navigaciju na link iz notifikacije

### Hook: `src/hooks/usePushNotifications.ts`
- Proverava da li browser podrzava Push API
- Proverava/zahteva dozvolu
- Subscribe/unsubscribe logika
- Cuva subscription u `push_subscriptions` tabeli

### Edge funkcija: izmena `send-notification-emails`
- Posle kreiranja in-app notifikacije, proveriti da li korisnik ima `push_notifications_enabled = true`
- Ako da, poslati web push na sve registrovane subscription-e tog korisnika
- Koristiti `web-push` biblioteku za slanje

---

## Deo 3: Settings UI

### Izmena: `src/pages/Profile.tsx` - Settings tab

Posle Email notifikacije karte, dodati dve nove karte:

**Karta: "App notifikacije" (ikona: Bell)**
- Opis: "Notifikacije koje se prikazuju u aplikaciji (zvonce u headeru)"
- Switch: Faktura pregledana - "Obavestenje kada klijent otvori fakturu" (uvek ukljuceno, ne moze se iskljuciti za sada jer nema zasebnu kontrolu - ovo je podrazumevano ponasanje)
- Switch: Podsetnici - "Prikazi notifikaciju u aplikaciji za podsetnike"
- Switch: Istek pretplate - "Prikazi notifikaciju u aplikaciji kada pretplata istice"
- Switch: Upozorenja za limite - "Prikazi notifikaciju u aplikaciji za limite"

Za ovo ce trebati nove kolone u profiles:
- `app_notify_reminders` (BOOLEAN, default true)
- `app_notify_subscription` (BOOLEAN, default true)
- `app_notify_limits` (BOOLEAN, default true)

Edge funkcija ce proveravati ove preference pre kreiranja notifikacije.

**Karta: "Push notifikacije" (ikona: Smartphone)**
- Opis: "Primajte notifikacije i kada aplikacija nije otvorena"
- Status badge koji pokazuje da li je dozvola data u browseru
- Glavni Switch: "Omoguci push notifikacije"
  - Kada se ukljuci: trazi dozvolu browsera, registruje service worker, subscribuje se
  - Kada se iskljuci: unsubscribuje se, brise iz baze
- Dugme: "Posalji test notifikaciju" - za testiranje

---

## Tehnicki detalji

### SQL migracija
```
-- Push subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- App notification preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_notify_reminders BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_notify_subscription BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_notify_limits BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT false;
```

### Service Worker (`public/sw.js`)
```
self.addEventListener('push', function(event) {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'PausalBox', {
      body: data.message,
      icon: '/favicon.png',
      data: { url: data.link }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
```

### VAPID kljucevi
- Generisati VAPID key pair
- Javni kljuc: hardkodiran u frontendu (env varijabla VITE_VAPID_PUBLIC_KEY)
- Privatni kljuc: secret VAPID_PRIVATE_KEY u edge funkcijama
- VAPID subject: `mailto:obavestenja@pausalbox.rs`

### Edge funkcija izmene
`send-notification-emails/index.ts`:
1. Dodati `insertNotification` helper (uz proveru app_notify preference)
2. Dodati `sendPushNotification` helper (uz proveru push_notifications_enabled)
3. Posle svakog uspesnog email slanja pozvati oba helpera

### Fajlovi koji se menjaju/kreiraju
- `supabase/functions/send-notification-emails/index.ts` - in-app + push notifikacije
- `src/components/NotificationBell.tsx` - nove ikone za tipove
- `src/hooks/usePushNotifications.ts` - NOVO: push subscription logika
- `src/pages/Profile.tsx` - nove Settings karte
- `src/lib/auth.tsx` - nove kolone u ProfileData interfejs
- `public/sw.js` - NOVO: service worker za push
- SQL migracija za novu tabelu i kolone

