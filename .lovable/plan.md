

# Fix Cyrillic to Latin Script in Serbian Translations

## Problem

The screenshot shows "offlineReceipts" displayed as a raw key, and several labels appear in Cyrillic script (e.g., "Статус фискалних рачуна"). The app should use Serbian **Latin** script exclusively.

## Root Cause

In `src/i18n/translations.ts`, lines 2909-2931 contain **Cyrillic** Serbian text instead of Latin. Additionally, the key `offlineReceipts` is missing entirely from the Serbian (`sr`) section.

## Changes

**File**: `src/i18n/translations.ts` (lines 2909-2931)

Convert all 23 Cyrillic values to Latin and add the missing `offlineReceipts` key:

| Key | Cyrillic (current) | Latin (fix) |
|-----|-------------------|-------------|
| eBolovanje | еБоловање | eBolovanje |
| eBolovanjeRequired | Интеграција еБоловање... | Integracija eBolovanje je obavezna od 1. januara 2026. |
| eBolovanjeDescription | Јединствени систем... | Jedinstveni sistem poslodavaca (eBolovanje -- Poslodavac) zahteva registraciju poslodavaca na eUpravi i elektronsku razmenu potvrda/doznaka o bolovanju. Podnosenje zahteva i prigovora pocinje 3. marta 2026. |
| eBolovanjeFeature1 | Регистрација... | Registracija i autentifikacija na portalu eUprava |
| eBolovanjeFeature2 | Електронска... | Elektronska razmena potvrda o bolovanju (doznake) |
| eBolovanjeFeature3 | Подношење... | Podnosenje zahteva i prigovora (od 3. marta 2026.) |
| eBolovanjeFeature4 | Интеграција... | Integracija sa zahtevima za odsustvo i obracunom zarada |
| pdfReady | PDF извештај... | PDF izvestaj je spreman. |
| fiscalReceiptStatus | Статус фискалних рачуна | Status fiskalnih racuna |
| signedReceipts | Потписани | Potpisani |
| **offlineReceipts** | *(missing)* | **Oflajn racuni** |
| failedReceipts | Неуспели | Neuspeli |
| noReceipts | Нема пронађених... | Nema pronadjenih racuna. |
| paymentMethod | Начин плаћања | Nacin placanja |
| activeSessions | Активне сесије | Aktivne sesije |
| apiCalls24h | API позиви (24ч) | API pozivi (24c) |
| errors24h | Грешке (24ч) | Greske (24c) |
| systemEvents | Системски догађаји | Sistemski dogadjaji |
| noSystemEvents | Нема забележених... | Nema zabelezenih sistemskih dogadjaja. |
| events | догађаја | dogadjaja |
| errorMessage | Грешка | Greska |
| timestamp | Временска ознака | Vremenska oznaka |
| pollAllSef | Освежи СЕФ статусе | Osvezi SEF statuse |
| checked | проверено | provereno |

## Scope

- **1 file** modified: `src/i18n/translations.ts`
- **23 values** converted from Cyrillic to Latin
- **1 missing key** added (`offlineReceipts`)
- No other files or logic changes needed

