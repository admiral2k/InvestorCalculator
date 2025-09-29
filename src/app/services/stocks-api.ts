import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, tap } from 'rxjs';

export interface TickerResult {
  ticker: string;
  selected?: { dateUsed: string; close: number };
  latest?: { date: string; close: number };
  error?: string;
}

export interface BatchResponse {
  dateRequested: string;
  results: TickerResult[];
}

export interface StockModel {
  ticker: string;
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  returnPct: number;       // 33.5 = +33.5%
  initialInvestment: number;
  currentValue: number;
  profit: number;
}

@Injectable({ providedIn: 'root' })
export class StocksService {
  private http = inject(HttpClient);

  top10 = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH'];

  getStocksTableSimple(
    dateISO: string,
    initialInvestmentPerTicker: number,
    tickers: string[] = this.top10
  ): Observable<StockModel[]> {
    return this.getPrices(dateISO, tickers).pipe(
      tap(res => {
        const errs = res.results.filter(r => r.error);
        if (errs.length) {
          console.warn('Stock fetch errors (will fallback to demo for these):', errs.map(e => e.ticker));
        }
      }),
      map(res => {
        // Словарь по тикеру
        const byTicker = new Map(res.results.map(r => [r.ticker.toUpperCase(), r]));

        // Для каждого тикера — либо реальная строка, либо демо
        return tickers.map(t => {
          const key = t.toUpperCase();
          const r = byTicker.get(key);

          const realOk =
            r && !r.error && r.selected && r.latest &&
            isFiniteNumber(r.selected.close) &&
            isFiniteNumber(r.latest.close) &&
            r.selected.close > 0;

          if (realOk) {
            const buyPrice = r!.selected!.close;
            const sellPrice = r!.latest!.close;
            return buildRow(
              key,
              r!.selected!.dateUsed,
              buyPrice,
              r!.latest!.date,
              sellPrice,
              initialInvestmentPerTicker
            );
          }

          // Фоллбек: демо-данные
          const demo = this.makeDemoRow(key, dateISO, initialInvestmentPerTicker);
          return demo;
        });
      })
    );
  }

  getPrices(dateISO: string, tickers: string[]): Observable<BatchResponse> {
    const tasks = tickers.map(t => this.fetchOne(t, dateISO));
    return forkJoin(tasks).pipe(map(results => ({ dateRequested: dateISO, results })));
  }

  // ---------- internal ----------

  private fetchOne(ticker: string, dateISO: string): Observable<TickerResult> {
    const url = `/stooq/q/d/l/?s=${ticker.toLowerCase()}.us&i=d`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      map(csv => {
        const rows = this.parseCsv(csv);
        if (!rows.length) {
          return { ticker, error: 'Empty/invalid CSV (proxy/CORS/404/limit?)' };
        }
        const selected = this.findCloseOnOrBefore(rows, dateISO);
        const latest = this.findLatestClose(rows);
        if (!selected) return { ticker, error: `No data on or before ${dateISO}` };
        if (!latest) return { ticker, error: 'No latest data' };
        return { ticker, selected, latest };
      }),
      catchError((err: any) => {
        const msg = err?.message ?? String(err);
        return of({ ticker, error: `Network/HTTP error: ${msg}` } as TickerResult);
      })
    );
  }

  private parseCsv(text: string): Array<Record<string, string>> {
    const trimmed = (text ?? '').trim();
    if (!trimmed || !trimmed.startsWith('Date,')) {
      console.warn('Unexpected CSV header. First 120 chars:', trimmed.slice(0, 120));
      return [];
    }
    const lines = trimmed.split(/\r?\n/);
    const header = (lines.shift() ?? '').split(',');
    if (!header.length) return [];

    const out = lines
      .map(l => l.split(','))
      .filter(cols => cols.length === header.length)
      .map(cols => Object.fromEntries(header.map((h, i) => [h, cols[i]])));

    return out;
  }

  private findCloseOnOrBefore(
    rows: Array<Record<string, string>>,
    dateISO: string
  ): { dateUsed: string; close: number } | null {
    const target = dateKey(dateISO);
    if (!Number.isFinite(target)) return null;

    for (let i = rows.length - 1; i >= 0; i--) {
      const d = rows[i]['Date'];
      const c = rows[i]['Close'];
      const dk = d ? dateKey(d) : NaN;
      const n = c ? Number(c) : NaN;
      if (Number.isFinite(dk) && Number.isFinite(n) && n > 0 && dk <= target) {
        return { dateUsed: d!, close: n };
      }
    }
    return null;
  }

  private findLatestClose(
    rows: Array<Record<string, string>>
  ): { date: string; close: number } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const d = rows[i]['Date'];
      const c = rows[i]['Close'];
      const n = c ? Number(c) : NaN;
      if (d && Number.isFinite(n) && n > 0) {
        return { date: d, close: n };
      }
    }
    return null;
  }

  /** Демо-строка (детерминированная по тикеру) */
  private makeDemoRow(ticker: string, buyDateISO: string, amount: number): StockModel {
    const today = new Date().toISOString().slice(0, 10);

    // Псевдорандом по тикеру (стабильно между перезагрузками)
    const seed = hashStr(ticker + buyDateISO);
    // buy в диапазоне [40..400]
    const buyPrice = 40 + (seed % 361); // 40..400
    // доходность -20%..+80%
    const ret = -0.2 + ((seed * 9301 + 49297) % 1000) / 1000 * 1.0; // ~ -0.2..+0.8
    const sellPrice = round2(buyPrice * (1 + ret));

    return buildRow(ticker, buyDateISO, buyPrice, today, sellPrice, amount);
  }
}

// --- helpers ---

function dateKey(iso: string): number {
  return Number(iso.replace(/-/g, '')); // "2025-09-08" -> 20250908
}
function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
function buildRow(
  ticker: string,
  buyDate: string,
  buyPrice: number,
  sellDate: string,
  sellPrice: number,
  amount: number
): StockModel {
  const growth = sellPrice / buyPrice;
  const currentValue = amount * growth;
  const profit = currentValue - amount;
  const returnPct = (growth - 1) * 100;

  return {
    ticker,
    buyDate,
    buyPrice: round2(buyPrice),
    sellDate,
    sellPrice: round2(sellPrice),
    returnPct: round2(returnPct),
    initialInvestment: round2(amount),
    currentValue: round2(currentValue),
    profit: round2(profit),
  };
}
