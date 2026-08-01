// Payment modes and the region-aware list of providers shown alongside them.
//
// The three top-level modes are fixed (Cash / UPI / Card). The adjacent provider
// dropdown, however, adapts to the space's selected currency: an Indian user
// (INR) picking "UPI" sees Google Pay / PhonePe / Paytm, while a US user (USD)
// sees Apple Pay / Venmo / Zelle, and "Card" shows locally-relevant banks. Users
// can always pick "Other…" and type their own — nothing here is a hard limit.

export const PAYMENT_MODES = ["Cash", "UPI", "Card"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

// Sentinel option that reveals a free-text input for anything not listed.
export const OTHER_PROVIDER = "Other";

// Map a currency code to a coarse region key used to pick provider lists.
function regionFor(currencyCode: string): string {
  switch (currencyCode) {
    case "INR":
      return "IN";
    case "USD":
      return "US";
    case "GBP":
      return "UK";
    case "EUR":
      return "EU";
    case "AED":
      return "AE";
    case "SGD":
      return "SG";
    case "AUD":
      return "AU";
    case "CAD":
      return "CA";
    case "JPY":
      return "JP";
    case "CHF":
      return "CH";
    case "CNY":
      return "CN";
    default:
      return "GLOBAL";
  }
}

// UPI / wallet apps by region. (Outside India "UPI" stands in for the local
// instant-pay wallet ecosystem — the closest equivalent for that mode.)
const UPI_PROVIDERS: Record<string, string[]> = {
  IN: ["Google Pay", "PhonePe", "Paytm", "Amazon Pay", "BHIM", "CRED"],
  US: ["Apple Pay", "Google Pay", "Venmo", "Cash App", "Zelle", "PayPal"],
  UK: ["Apple Pay", "Google Pay", "PayPal", "Revolut", "Monzo"],
  EU: ["Apple Pay", "Google Pay", "PayPal", "Revolut", "N26"],
  AE: ["Apple Pay", "Google Pay", "Samsung Pay", "Careem Pay"],
  SG: ["PayNow", "GrabPay", "Google Pay", "Apple Pay"],
  AU: ["Apple Pay", "Google Pay", "PayPal", "Beem"],
  CA: ["Interac", "Apple Pay", "Google Pay", "PayPal"],
  JP: ["PayPay", "LINE Pay", "Rakuten Pay", "Apple Pay"],
  CH: ["TWINT", "Apple Pay", "Google Pay"],
  CN: ["Alipay", "WeChat Pay", "UnionPay"],
  GLOBAL: ["Apple Pay", "Google Pay", "PayPal"],
};

// Card issuers / banks by region.
const CARD_PROVIDERS: Record<string, string[]> = {
  IN: ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "IDFC First", "Uni", "Amex"],
  US: ["Chase", "Bank of America", "Amex", "Wells Fargo", "Citi", "Capital One", "Discover"],
  UK: ["Barclays", "HSBC", "Lloyds", "NatWest", "Monzo", "Revolut", "Amex"],
  EU: ["Revolut", "N26", "Deutsche Bank", "BNP Paribas", "ING", "Amex"],
  AE: ["Emirates NBD", "ADCB", "FAB", "Mashreq", "Amex"],
  SG: ["DBS", "OCBC", "UOB", "Citi", "Amex"],
  AU: ["CommBank", "NAB", "ANZ", "Westpac", "Amex"],
  CA: ["RBC", "TD", "Scotiabank", "BMO", "CIBC", "Amex"],
  JP: ["Rakuten", "JCB", "MUFG", "Amex"],
  CH: ["UBS", "PostFinance", "Credit Suisse", "Amex"],
  CN: ["UnionPay", "ICBC", "CCB", "Amex"],
  GLOBAL: ["Visa", "Mastercard", "Amex"],
};

/**
 * Provider options for a given mode + currency. Cash has no provider; UPI and
 * Card return a region-appropriate list. The caller appends the "Other…" option
 * itself so it can render the custom-text field when it's chosen.
 */
export function paymentProviders(mode: string, currencyCode: string): string[] {
  if (mode === "UPI") return UPI_PROVIDERS[regionFor(currencyCode)] ?? UPI_PROVIDERS.GLOBAL;
  if (mode === "Card") return CARD_PROVIDERS[regionFor(currencyCode)] ?? CARD_PROVIDERS.GLOBAL;
  return [];
}

/** Human label for a stored expense, e.g. "UPI · Google Pay" or "Cash". */
export function paymentLabel(mode?: string | null, detail?: string | null): string {
  if (!mode) return "";
  return detail ? `${mode} · ${detail}` : mode;
}
