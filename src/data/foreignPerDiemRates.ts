/**
 * Foreign per diem rates per Uredba o naknadi troškova za službena putovanja u inostranstvo
 * (Sl. glasnik RS, br. 10/2022)
 * Rates in EUR unless otherwise noted
 */
export interface PerDiemRate {
  country: string;
  countryCode: string;
  dailyRate: number;
  currency: string;
  hotelLimit: number;
}

export const foreignPerDiemRates: PerDiemRate[] = [
  { country: "Albanija", countryCode: "AL", dailyRate: 40, currency: "EUR", hotelLimit: 90 },
  { country: "Austrija", countryCode: "AT", dailyRate: 66, currency: "EUR", hotelLimit: 130 },
  { country: "Belgija", countryCode: "BE", dailyRate: 66, currency: "EUR", hotelLimit: 150 },
  { country: "Bosna i Hercegovina", countryCode: "BA", dailyRate: 35, currency: "EUR", hotelLimit: 80 },
  { country: "Bugarska", countryCode: "BG", dailyRate: 40, currency: "EUR", hotelLimit: 90 },
  { country: "Crna Gora", countryCode: "ME", dailyRate: 35, currency: "EUR", hotelLimit: 80 },
  { country: "Češka", countryCode: "CZ", dailyRate: 50, currency: "EUR", hotelLimit: 110 },
  { country: "Danska", countryCode: "DK", dailyRate: 70, currency: "EUR", hotelLimit: 160 },
  { country: "Finska", countryCode: "FI", dailyRate: 66, currency: "EUR", hotelLimit: 140 },
  { country: "Francuska", countryCode: "FR", dailyRate: 66, currency: "EUR", hotelLimit: 150 },
  { country: "Grčka", countryCode: "GR", dailyRate: 55, currency: "EUR", hotelLimit: 120 },
  { country: "Holandija", countryCode: "NL", dailyRate: 66, currency: "EUR", hotelLimit: 140 },
  { country: "Hrvatska", countryCode: "HR", dailyRate: 45, currency: "EUR", hotelLimit: 100 },
  { country: "Irska", countryCode: "IE", dailyRate: 66, currency: "EUR", hotelLimit: 150 },
  { country: "Italija", countryCode: "IT", dailyRate: 66, currency: "EUR", hotelLimit: 140 },
  { country: "Japan", countryCode: "JP", dailyRate: 80, currency: "EUR", hotelLimit: 180 },
  { country: "Kanada", countryCode: "CA", dailyRate: 66, currency: "EUR", hotelLimit: 140 },
  { country: "Kina", countryCode: "CN", dailyRate: 60, currency: "EUR", hotelLimit: 130 },
  { country: "Mađarska", countryCode: "HU", dailyRate: 50, currency: "EUR", hotelLimit: 110 },
  { country: "Makedonija", countryCode: "MK", dailyRate: 35, currency: "EUR", hotelLimit: 80 },
  { country: "Nemačka", countryCode: "DE", dailyRate: 66, currency: "EUR", hotelLimit: 140 },
  { country: "Norveška", countryCode: "NO", dailyRate: 70, currency: "EUR", hotelLimit: 160 },
  { country: "Poljska", countryCode: "PL", dailyRate: 45, currency: "EUR", hotelLimit: 100 },
  { country: "Portugal", countryCode: "PT", dailyRate: 55, currency: "EUR", hotelLimit: 120 },
  { country: "Rumunija", countryCode: "RO", dailyRate: 40, currency: "EUR", hotelLimit: 90 },
  { country: "Rusija", countryCode: "RU", dailyRate: 55, currency: "EUR", hotelLimit: 120 },
  { country: "SAD", countryCode: "US", dailyRate: 75, currency: "EUR", hotelLimit: 170 },
  { country: "Slovačka", countryCode: "SK", dailyRate: 50, currency: "EUR", hotelLimit: 110 },
  { country: "Slovenija", countryCode: "SI", dailyRate: 50, currency: "EUR", hotelLimit: 110 },
  { country: "Španija", countryCode: "ES", dailyRate: 60, currency: "EUR", hotelLimit: 130 },
  { country: "Švedska", countryCode: "SE", dailyRate: 70, currency: "EUR", hotelLimit: 160 },
  { country: "Švajcarska", countryCode: "CH", dailyRate: 80, currency: "EUR", hotelLimit: 180 },
  { country: "Turska", countryCode: "TR", dailyRate: 50, currency: "EUR", hotelLimit: 110 },
  { country: "Ujedinjeni Arapski Emirati", countryCode: "AE", dailyRate: 66, currency: "EUR", hotelLimit: 160 },
  { country: "Ujedinjeno Kraljevstvo", countryCode: "GB", dailyRate: 70, currency: "EUR", hotelLimit: 160 },
  // Default for unlisted countries
  { country: "Ostale zemlje", countryCode: "XX", dailyRate: 45, currency: "EUR", hotelLimit: 100 },
];

export function getPerDiemRate(countryCode: string): PerDiemRate {
  return foreignPerDiemRates.find(r => r.countryCode === countryCode) 
    || foreignPerDiemRates.find(r => r.countryCode === "XX")!;
}
