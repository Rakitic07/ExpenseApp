// Payment modes and the region-aware provider list shown alongside them. Mirrors
// the web app so both stay consistent.

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const OTHER_PROVIDER = 'Other';

function regionFor(currencyCode: string): string {
  switch (currencyCode) {
    case 'INR':
      return 'IN';
    case 'USD':
      return 'US';
    case 'GBP':
      return 'UK';
    case 'EUR':
      return 'EU';
    case 'AED':
      return 'AE';
    case 'SGD':
      return 'SG';
    case 'AUD':
      return 'AU';
    case 'CAD':
      return 'CA';
    case 'JPY':
      return 'JP';
    case 'CHF':
      return 'CH';
    case 'CNY':
      return 'CN';
    default:
      return 'GLOBAL';
  }
}

const UPI_PROVIDERS: Record<string, string[]> = {
  IN: ['Google Pay', 'PhonePe', 'Paytm', 'Amazon Pay', 'BHIM', 'CRED'],
  US: ['Apple Pay', 'Google Pay', 'Venmo', 'Cash App', 'Zelle', 'PayPal'],
  UK: ['Apple Pay', 'Google Pay', 'PayPal', 'Revolut', 'Monzo'],
  EU: ['Apple Pay', 'Google Pay', 'PayPal', 'Revolut', 'N26'],
  AE: ['Apple Pay', 'Google Pay', 'Samsung Pay', 'Careem Pay'],
  SG: ['PayNow', 'GrabPay', 'Google Pay', 'Apple Pay'],
  AU: ['Apple Pay', 'Google Pay', 'PayPal', 'Beem'],
  CA: ['Interac', 'Apple Pay', 'Google Pay', 'PayPal'],
  JP: ['PayPay', 'LINE Pay', 'Rakuten Pay', 'Apple Pay'],
  CH: ['TWINT', 'Apple Pay', 'Google Pay'],
  CN: ['Alipay', 'WeChat Pay', 'UnionPay'],
  GLOBAL: ['Apple Pay', 'Google Pay', 'PayPal'],
};

const CARD_PROVIDERS: Record<string, string[]> = {
  IN: ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'IDFC First', 'Uni', 'Amex'],
  US: ['Chase', 'Bank of America', 'Amex', 'Wells Fargo', 'Citi', 'Capital One', 'Discover'],
  UK: ['Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Monzo', 'Revolut', 'Amex'],
  EU: ['Revolut', 'N26', 'Deutsche Bank', 'BNP Paribas', 'ING', 'Amex'],
  AE: ['Emirates NBD', 'ADCB', 'FAB', 'Mashreq', 'Amex'],
  SG: ['DBS', 'OCBC', 'UOB', 'Citi', 'Amex'],
  AU: ['CommBank', 'NAB', 'ANZ', 'Westpac', 'Amex'],
  CA: ['RBC', 'TD', 'Scotiabank', 'BMO', 'CIBC', 'Amex'],
  JP: ['Rakuten', 'JCB', 'MUFG', 'Amex'],
  CH: ['UBS', 'PostFinance', 'Credit Suisse', 'Amex'],
  CN: ['UnionPay', 'ICBC', 'CCB', 'Amex'],
  GLOBAL: ['Visa', 'Mastercard', 'Amex'],
};

export function paymentProviders(mode: string, currencyCode: string): string[] {
  if (mode === 'UPI') return UPI_PROVIDERS[regionFor(currencyCode)] ?? UPI_PROVIDERS.GLOBAL;
  if (mode === 'Card') return CARD_PROVIDERS[regionFor(currencyCode)] ?? CARD_PROVIDERS.GLOBAL;
  return [];
}

export function paymentLabel(mode?: string | null, detail?: string | null): string {
  if (!mode) return '';
  return detail ? `${mode} · ${detail}` : mode;
}
