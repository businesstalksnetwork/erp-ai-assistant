
# Plan: Zamena fonta za čistu nulu (bez tačke u sredini)

## Problem
Trenutno korišćeni font **Plus Jakarta Sans** ima stilizovanu cifru 0 sa tačkom/crtom u sredini kruga ("slashed zero"). Korisnik želi običnu, čistu nulu.

## Rešenje
Zameniti font **Plus Jakarta Sans** sa **Inter** fontom koji ima čistu nulu bez ikakvih oznaka u sredini.

**Inter font** je:
- Moderan, profesionalan sans-serif font
- Ima čistu cifru 0 bez tačke
- Odličan za brojeve i poslovne dokumente
- Besplatan (Google Fonts)
- Ima slične težine (400, 500, 600, 700)

## Fajlovi za izmenu

### 1. src/index.css
- Promeniti Google Fonts import sa Plus Jakarta Sans na Inter
- Ažurirati CSS varijable za font

### 2. tailwind.config.ts  
- Ažurirati fontFamily konfiguraciju da koristi Inter umesto Plus Jakarta Sans

## Vizuelni uticaj
- Cifra 0 će sada biti čist krug bez tačke u sredini
- Svi tekstovi u aplikaciji će koristiti Inter font
- Font je sličnog stila tako da vizuelni identitet ostaje konzistentan
