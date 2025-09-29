import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';

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
  returnPct: number;       // напр. 33.5 = +33.5%
  initialInvestment: number;
  currentValue: number;
  profit: number;
}

@Injectable({ providedIn: 'root' })
export class StocksService {
  private http = inject(HttpClient);
  top10 = ['AAPL','MSFT','AMZN','GOOGL','NVDA','META','TSLA','JPM','V','UNH'];

  getStocksTableSimple(
    dateISO: string,
    initialInvestmentPerTicker: number,
    tickers: string[] = this.top10
  ): Observable<StockModel[]> {
    return this.getPrices(dateISO, tickers).pipe(
      map(res => res.results),
      map(results => results
        .filter(r => !r.error && r.selected && r.latest && r.selected.close > 0)
        .map(r => {
          const buyPrice = r!.selected!.close;
          const sellPrice = r!.latest!.close;

          const growth = sellPrice / buyPrice;
          const currentValue = initialInvestmentPerTicker * growth;
          const profit = currentValue - initialInvestmentPerTicker;
          const returnPct = (growth - 1) * 100;

          return {
            ticker: r!.ticker,
            buyDate: r!.selected!.dateUsed,
            buyPrice,
            sellDate: r!.latest!.date,
            sellPrice,
            returnPct: +returnPct.toFixed(2),
            initialInvestment: +initialInvestmentPerTicker.toFixed(2),
            currentValue: +currentValue.toFixed(2),
            profit: +profit.toFixed(2),
          } as StockModel;
        })
      )
    );
  }

  getPrices(dateISO: string, tickers: string[]): Observable<BatchResponse> {
    const tasks = tickers.map(t => this.fetchOne(t, dateISO));
    return forkJoin(tasks).pipe(
      map(results => ({ dateRequested: dateISO, results }))
    );
  }

  // --- inside ---

  private fetchOne(ticker: string, dateISO: string): Observable<TickerResult> {
    const url = `/stooq/q/d/l/?s=${ticker.toLowerCase()}.us&i=d`;
    return this.http.get(url, { responseType: 'text' }).pipe(
      map(csv => {
        try {
          const rows = this.parseCsv(csv);               // [{Date,Open,High,Low,Close,Volume}, ...]
          const selected = this.findCloseOnOrBefore(rows, dateISO);
          const latest = this.findLatestClose(rows);
          if (!selected) return { ticker, error: `No data on or before ${dateISO}` };
          if (!latest) return { ticker, error: 'No latest data' };
          return { ticker, selected, latest };
        } catch (e: any) {
          return { ticker, error: String(e?.message || e) };
        }
      })
    );
  }

  private parseCsv(text: string): Array<Record<string, string>> {
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift()?.split(',') ?? [];
    return lines
      .map(l => l.split(','))
      .filter(cols => cols.length === header.length)
      .map(cols => Object.fromEntries(header.map((h, i) => [h, cols[i]])));
  }

  private findCloseOnOrBefore(
    rows: Array<Record<string, string>>,
    dateISO: string
  ): { dateUsed: string; close: number } | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const d = rows[i]['Date'];     // '2025-01-15'
      const c = rows[i]['Close'];    // '199.33'
      if (d && d <= dateISO && c && c !== '0') {
        const n = Number(c);
        if (!Number.isNaN(n)) return { dateUsed: d, close: n };
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
      if (d && c && c !== '0') {
        const n = Number(c);
        if (!Number.isNaN(n)) return { date: d, close: n };
      }
    }
    return null;
  }
}
