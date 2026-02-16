
## Izmene u mobilnoj donjoj navigaciji

### Fajl: `src/components/AppLayout.tsx`

**Linija 73-78** - Promeniti `mobileBottomNavItems` niz:
- Ukloniti KPO stavku
- Dodati "Moj Profil" sa `User` ikonom i rutom `/profile` posle Podsetnika

Novi niz:
```
{ href: '/dashboard', label: 'Pocetna', icon: LayoutDashboard }
{ href: '/invoices', label: 'Fakture', icon: FileText }
{ href: '/reminders', label: 'Podsetnici', icon: Bell }
{ href: '/profile', label: 'Profil', icon: User }
```

Ikona `User` je vec importovana u fajlu. Nema drugih izmena.
