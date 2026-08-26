export type Country = {
  iso: string;
  name: string;
  dial: string;
  min: number;
  max: number;
};

/** Dial-code + national-length table for the phone sign-in field. */
export const COUNTRIES: readonly Country[] = [
  { iso: "US", name: "United States", dial: "1", min: 10, max: 10 },
  { iso: "CA", name: "Canada", dial: "1", min: 10, max: 10 },
  { iso: "GB", name: "United Kingdom", dial: "44", min: 10, max: 10 },
  { iso: "AU", name: "Australia", dial: "61", min: 9, max: 9 },
  { iso: "NZ", name: "New Zealand", dial: "64", min: 8, max: 10 },
  { iso: "IE", name: "Ireland", dial: "353", min: 9, max: 9 },
  { iso: "MX", name: "Mexico", dial: "52", min: 10, max: 10 },
  { iso: "BR", name: "Brazil", dial: "55", min: 10, max: 11 },
  { iso: "AR", name: "Argentina", dial: "54", min: 10, max: 10 },
  { iso: "CO", name: "Colombia", dial: "57", min: 10, max: 10 },
  { iso: "CL", name: "Chile", dial: "56", min: 9, max: 9 },
  { iso: "PE", name: "Peru", dial: "51", min: 9, max: 9 },
  { iso: "ES", name: "Spain", dial: "34", min: 9, max: 9 },
  { iso: "FR", name: "France", dial: "33", min: 9, max: 9 },
  { iso: "DE", name: "Germany", dial: "49", min: 10, max: 11 },
  { iso: "IT", name: "Italy", dial: "39", min: 9, max: 11 },
  { iso: "NL", name: "Netherlands", dial: "31", min: 9, max: 9 },
  { iso: "BE", name: "Belgium", dial: "32", min: 8, max: 9 },
  { iso: "PT", name: "Portugal", dial: "351", min: 9, max: 9 },
  { iso: "SE", name: "Sweden", dial: "46", min: 7, max: 9 },
  { iso: "NO", name: "Norway", dial: "47", min: 8, max: 8 },
  { iso: "DK", name: "Denmark", dial: "45", min: 8, max: 8 },
  { iso: "FI", name: "Finland", dial: "358", min: 9, max: 10 },
  { iso: "PL", name: "Poland", dial: "48", min: 9, max: 9 },
  { iso: "CZ", name: "Czechia", dial: "420", min: 9, max: 9 },
  { iso: "AT", name: "Austria", dial: "43", min: 10, max: 11 },
  { iso: "CH", name: "Switzerland", dial: "41", min: 9, max: 9 },
  { iso: "GR", name: "Greece", dial: "30", min: 10, max: 10 },
  { iso: "TR", name: "Turkey", dial: "90", min: 10, max: 10 },
  { iso: "AE", name: "United Arab Emirates", dial: "971", min: 9, max: 9 },
  { iso: "SA", name: "Saudi Arabia", dial: "966", min: 9, max: 9 },
  { iso: "IL", name: "Israel", dial: "972", min: 9, max: 9 },
  { iso: "EG", name: "Egypt", dial: "20", min: 10, max: 10 },
  { iso: "ZA", name: "South Africa", dial: "27", min: 9, max: 9 },
  { iso: "NG", name: "Nigeria", dial: "234", min: 10, max: 10 },
  { iso: "KE", name: "Kenya", dial: "254", min: 9, max: 9 },
  { iso: "IN", name: "India", dial: "91", min: 10, max: 10 },
  { iso: "PK", name: "Pakistan", dial: "92", min: 10, max: 10 },
  { iso: "BD", name: "Bangladesh", dial: "880", min: 10, max: 10 },
  { iso: "PH", name: "Philippines", dial: "63", min: 10, max: 10 },
  { iso: "ID", name: "Indonesia", dial: "62", min: 9, max: 12 },
  { iso: "MY", name: "Malaysia", dial: "60", min: 9, max: 10 },
  { iso: "SG", name: "Singapore", dial: "65", min: 8, max: 8 },
  { iso: "TH", name: "Thailand", dial: "66", min: 9, max: 9 },
  { iso: "VN", name: "Vietnam", dial: "84", min: 9, max: 10 },
  { iso: "JP", name: "Japan", dial: "81", min: 10, max: 10 },
  { iso: "KR", name: "South Korea", dial: "82", min: 9, max: 10 },
  { iso: "CN", name: "China", dial: "86", min: 11, max: 11 },
  { iso: "TW", name: "Taiwan", dial: "886", min: 9, max: 9 },
  { iso: "HK", name: "Hong Kong", dial: "852", min: 8, max: 8 },
  { iso: "RU", name: "Russia", dial: "7", min: 10, max: 10 },
  { iso: "UA", name: "Ukraine", dial: "380", min: 9, max: 9 },
  { iso: "PR", name: "Puerto Rico", dial: "1", min: 10, max: 10 },
] as const;

const COUNTRY_BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));

const TZ_ISO: Record<string, string> = {
  "America/Los_Angeles": "US",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO",
  "America/Santiago": "CL",
  "America/Lima": "PE",
  "America/Puerto_Rico": "PR",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Lisbon": "PT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Vienna": "AT",
  "Europe/Zurich": "CH",
  "Europe/Athens": "GR",
  "Europe/Istanbul": "TR",
  "Europe/Moscow": "RU",
  "Europe/Kyiv": "UA",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Jerusalem": "IL",
  "Africa/Cairo": "EG",
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Asia/Kolkata": "IN",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Manila": "PH",
  "Asia/Jakarta": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Singapore": "SG",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Taipei": "TW",
  "Asia/Hong_Kong": "HK",
};

export function countryByIso(iso: string): Country | undefined {
  return COUNTRY_BY_ISO.get(iso.toUpperCase());
}

export function guessCountryIso(): string {
  if (typeof Intl === "undefined") return "US";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_ISO[tz]) return TZ_ISO[tz]!;
    if (tz?.startsWith("America/")) return "US";
    if (tz?.startsWith("Europe/")) return "GB";
    if (tz?.startsWith("Australia/")) return "AU";
    if (tz?.startsWith("Asia/")) return "IN";
  } catch {
    /* ignore */
  }
  return "US";
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** National subscriber number: drop a trunk prefix 0 (except NANP). */
export function nationalDigits(iso: string, raw: string): string {
  let d = digitsOnly(raw);
  const country = countryByIso(iso);
  if ((iso === "US" || iso === "CA" || iso === "PR") && d.length === 11 && d.startsWith("1")) {
    d = d.slice(1);
  }
  if (country && country.dial !== "1" && d.startsWith("0")) {
    d = d.replace(/^0+/, "");
  }
  return d.slice(0, country?.max ?? 15);
}

export function isValidNational(iso: string, national: string): boolean {
  const country = countryByIso(iso);
  if (!country) return false;
  const d = nationalDigits(iso, national);
  return d.length >= country.min && d.length <= country.max;
}

export function toE164(iso: string, national: string): string {
  const country = countryByIso(iso);
  if (!country) throw new Error("Unknown country.");
  const d = nationalDigits(iso, national);
  return `+${country.dial}${d}`;
}

export function formatNational(iso: string, national: string): string {
  const d = nationalDigits(iso, national);
  if (iso === "US" || iso === "CA" || iso === "PR") {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }
  if (iso === "GB") {
    if (d.length <= 4) return d;
    return `${d.slice(0, 4)} ${d.slice(4)}`;
  }
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 3) parts.push(d.slice(i, i + 3));
  return parts.join(" ");
}

export function formatE164(e164: string): string {
  const digits = digitsOnly(e164);
  let best: Country | undefined;
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue;
    if (!best || c.dial.length > best.dial.length) best = c;
  }
  if (!best) return e164.startsWith("+") ? e164 : `+${digits}`;
  const national = digits.slice(best.dial.length);
  return `+${best.dial} ${formatNational(best.iso, national)}`;
}

export function filterCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...COUNTRIES];
  const qDigits = digitsOnly(q);
  return COUNTRIES.filter((c) => {
    if (c.name.toLowerCase().includes(q) || c.iso.toLowerCase().includes(q)) return true;
    if (qDigits && (c.dial.startsWith(qDigits) || `+${c.dial}`.includes(q))) return true;
    return false;
  });
}
