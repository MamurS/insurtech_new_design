// services/cbuService.ts
// Central Bank of Uzbekistan Exchange Rate API Integration

import { Currency, ExchangeRate } from '../types';
import { DB } from './db';

// Multiple CORS proxies to try (in order of preference)
const CORS_PROXIES = [
  { prefix: 'https://api.cors.lol/?url=', encode: true },
  { prefix: 'https://proxy.corsfix.com/?', encode: true },
  { prefix: 'https://api.codetabs.com/v1/proxy?quest=', encode: true },
  { prefix: 'https://corsproxy.io/?', encode: true },
  { prefix: 'https://api.allorigins.win/raw?url=', encode: true },
];

let activeProxyIndex = 0;

// Map CBU currency codes to our Currency enum
const CURRENCY_MAP: Record<string, Currency> = {
  'USD': Currency.USD,
  'EUR': Currency.EUR,
  'GBP': Currency.GBP,
  'RUB': Currency.RUB,
  'CNY': Currency.CNY,
  'JPY': Currency.JPY,
  'CHF': Currency.CHF,
  'KZT': Currency.KZT,
  'TRY': Currency.TRY,
  'AED': Currency.AED,
  'CAD': Currency.CAD,
  'AUD': Currency.AUD,
  'KRW': Currency.KRW,
  'INR': Currency.INR,
};

interface CBURateResponse {
  id: number;
  Code: string;
  Ccy: string;
  CcyNm_RU: string;
  CcyNm_UZ: string;
  CcyNm_UZC: string;
  CcyNm_EN: string;
  Nominal: string;
  Rate: string;
  Diff: string;
  Date: string;
}

export const CBUService = {
  /**
   * Fetch rates from CBU API — tries our own Cloudflare proxy first, then CORS proxy fallback
   * @param date - Optional date in YYYY-MM-DD format. If not provided, fetches current rates.
   */
  fetchRates: async (date?: string): Promise<CBURateResponse[]> => {
    // Try our own proxy first (works in production on Cloudflare Pages)
    try {
      const proxyUrl = date
        ? `/api/cbu-rates?date=${date}`
        : `/api/cbu-rates`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0 && data[0].Ccy && data[0].Rate) {
          console.log(`✓ CBU fetch successful via own proxy, got ${data.length} rates`);
          return data;
        }
      }
    } catch (e: any) {
      console.warn('Own proxy unavailable, trying CORS proxies:', e.message);
    }

    // Fallback: try third-party CORS proxies (for dev/localhost)
    const cbuUrl = date
      ? `https://cbu.uz/uz/arkhiv-kursov-valyut/json/all/${date}/`
      : `https://cbu.uz/uz/arkhiv-kursov-valyut/json/`;

    let lastError: Error | null = null;

    for (let i = 0; i < CORS_PROXIES.length; i++) {
      const proxyIndex = (activeProxyIndex + i) % CORS_PROXIES.length;
      const proxy = CORS_PROXIES[proxyIndex];
      const url = proxy.encode
        ? `${proxy.prefix}${encodeURIComponent(cbuUrl)}`
        : `${proxy.prefix}${cbuUrl}`;

      try {
        console.log(`Trying CBU fetch with proxy ${proxyIndex + 1}/${CORS_PROXIES.length}: ${proxy.prefix}`);

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        let data;

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Invalid JSON response');
        }

        if (!Array.isArray(data)) {
          throw new Error('Response is not an array');
        }

        if (data.length === 0) {
          throw new Error('Empty response');
        }

        // Validate first item has expected fields
        if (!data[0].Ccy || !data[0].Rate) {
          throw new Error('Invalid data structure');
        }

        // This proxy worked, remember it for next time
        activeProxyIndex = proxyIndex;
        console.log(`✓ CBU fetch successful via proxy ${proxyIndex + 1}, got ${data.length} rates`);
        return data;

      } catch (error: any) {
        console.warn(`✗ Proxy ${proxyIndex + 1} failed:`, error.message);
        lastError = error;
      }
    }

    throw new Error(`All CORS proxies failed. Last error: ${lastError?.message}`);
  },

  /**
   * Parse CBU date format (DD.MM.YYYY) to ISO string
   */
  parseDate: (cbuDate: string): string => {
    const [day, month, year] = cbuDate.split('.');
    return `${year}-${month}-${day}`;
  },

  /**
   * Calculate effective rate (handles Nominal > 1)
   * e.g., if Nominal=10 and Rate=76.31, effective rate per 1 unit = 7.631
   */
  calculateEffectiveRate: (rate: string, nominal: string): number => {
    const rateNum = parseFloat(rate);
    const nominalNum = parseInt(nominal, 10) || 1;
    return rateNum / nominalNum;
  },

  /**
   * Sync rates from CBU to local database
   * @param date - Date in YYYY-MM-DD format. Uses this date for saving (not the CBU response date).
   * Returns count of updated rates
   */
  syncRates: async (date: string): Promise<{ updated: number; date: string }> => {
    const cbuRates = await CBUService.fetchRates(date);
    let updated = 0;

    for (const cbuRate of cbuRates) {
      const currency = CURRENCY_MAP[cbuRate.Ccy];
      if (!currency) continue; // Skip currencies we don't track

      const effectiveRate = CBUService.calculateEffectiveRate(cbuRate.Rate, cbuRate.Nominal);
      const nominal = parseInt(cbuRate.Nominal, 10) || 1;

      const exchangeRate: ExchangeRate = {
        currency,
        rate: effectiveRate,
        date: date,
        // Save additional CBU fields
        nominal: nominal,
        diff: cbuRate.Diff,
        ccyNameEn: cbuRate.CcyNm_EN,
        rawRate: parseFloat(cbuRate.Rate),
      };

      await DB.saveExchangeRate(exchangeRate);
      updated++;
    }

    return { updated, date };
  },

  /**
   * Get a specific currency rate from CBU (fresh fetch)
   * @param currency - The currency to get rate for
   * @param date - Optional date in YYYY-MM-DD format
   */
  getRate: async (currency: Currency, date?: string): Promise<number | null> => {
    const cbuRates = await CBUService.fetchRates(date);
    const cbuCode = Object.entries(CURRENCY_MAP).find(([_, v]) => v === currency)?.[0];

    if (!cbuCode) return null;

    const rate = cbuRates.find(r => r.Ccy === cbuCode);
    if (!rate) return null;

    return CBUService.calculateEffectiveRate(rate.Rate, rate.Nominal);
  },

  /**
   * Get all rates with full details from CBU (for display)
   * @param date - Optional date in YYYY-MM-DD format
   */
  fetchRatesWithDetails: async (date?: string): Promise<Array<{
    currency: Currency;
    code: string;
    name: string;
    rate: number;
    nominal: number;
    rawRate: number;
    diff: number;
    date: string;
  }>> => {
    const cbuRates = await CBUService.fetchRates(date);
    const result = [];

    for (const cbuRate of cbuRates) {
      const currency = CURRENCY_MAP[cbuRate.Ccy];
      if (!currency) continue;

      result.push({
        currency,
        code: cbuRate.Ccy,
        name: cbuRate.CcyNm_EN,
        rate: CBUService.calculateEffectiveRate(cbuRate.Rate, cbuRate.Nominal),
        nominal: parseInt(cbuRate.Nominal, 10) || 1,
        rawRate: parseFloat(cbuRate.Rate),
        diff: parseFloat(cbuRate.Diff),
        date: CBUService.parseDate(cbuRate.Date),
      });
    }

    return result;
  },
};
