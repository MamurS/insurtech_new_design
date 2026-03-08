// hooks/useExchangeRate.ts
// Hook for accessing exchange rates with automatic fetching

import { useState, useEffect, useCallback } from 'react';
import { Currency } from '../types';
import { DB } from '../services/db';
import { CBUService } from '../services/cbuService';

interface UseExchangeRateOptions {
  autoFetch?: boolean; // Fetch from CBU if not in DB
}

export const useExchangeRate = (
  currency: Currency,
  options: UseExchangeRateOptions = {}
) => {
  const [rate, setRate] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRate = useCallback(async () => {
    if (currency === Currency.UZS) {
      setRate(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try local DB first
      let dbRate = await DB.getLatestRate(currency);

      // If not found and autoFetch enabled, try CBU
      if (!dbRate && options.autoFetch) {
        const cbuRate = await CBUService.getRate(currency);
        if (cbuRate) {
          dbRate = cbuRate;
        }
      }

      setRate(dbRate || 1);
    } catch (err: any) {
      setError(err.message);
      setRate(1);
    } finally {
      setLoading(false);
    }
  }, [currency, options.autoFetch]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  return { rate, loading, error, refetch: fetchRate };
};

/**
 * Convert amount from one currency to UZS
 */
export const convertToUZS = (amount: number, rate: number): number => {
  return amount * rate;
};

/**
 * Convert amount from UZS to target currency
 */
export const convertFromUZS = (amountUZS: number, rate: number): number => {
  if (rate === 0) return 0;
  return amountUZS / rate;
};

/**
 * Format currency amount with proper locale formatting
 */
export const formatCurrencyAmount = (
  amount: number,
  currency: Currency,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  } = {}
): string => {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
  } = options;

  const symbols: Record<Currency, string> = {
    [Currency.UZS]: "so'm",
    [Currency.USD]: '$',
    [Currency.EUR]: '\u20AC',
    [Currency.GBP]: '\u00A3',
    [Currency.RUB]: '\u20BD',
    [Currency.CNY]: '\u00A5',
    [Currency.JPY]: '\u00A5',
    [Currency.CHF]: 'CHF',
    [Currency.KZT]: '\u20B8',
    [Currency.TRY]: '\u20BA',
    [Currency.AED]: 'AED',
    [Currency.CAD]: 'C$',
    [Currency.AUD]: 'A$',
    [Currency.KRW]: '\u20A9',
    [Currency.INR]: '\u20B9',
  };

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  if (showSymbol) {
    const symbol = symbols[currency] || currency;
    // Put symbol before for most currencies, after for UZS
    return currency === Currency.UZS ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
  }

  return formatted;
};
