import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

export interface TickerResult {
  ticker: string; // оригинальный тикер, как ввёл пользователь (например "BRK.B")
  selected?: { dateUsed: string; close: number };
  latest?: { date: string; close: number };
  error?: string;
  // технические поля для логики:
  rateLimited?: boolean;        // сработал лимит ("Exceeded the daily hits limit")
  source?: 'cache' | 'network' | 'demo';
  reason?: string;              // пояснение для логов
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
  returnPct: number;
  initialInvestment: number;
  currentValue: number;
  profit: number;
}

@Injectable({ providedIn: 'root' })
export class StocksService {
  private http = inject(HttpClient);

  top10 = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH', 'MA', 'BRK.B'];

  // === ПУБЛИЧНЫЙ МЕТОД =======================================================
  getStocksTableSimple(
    dateISO: string,
    initialInvestmentPerTicker: number,
    tickers: string[] = this.top10
  ): Observable<StockModel[]> {
    return this.getPrices(dateISO, tickers).pipe(
      map(res => {
        const rows: StockModel[] = [];
        for (const r of res.results) {
          // успешные → в таблицу
          if (!r.error && r.selected && r.latest) {
            rows.push(buildRow(
              r.ticker,
              r.selected.dateUsed,
              r.selected.close,
              r.latest.date,
              r.latest.close,
              initialInvestmentPerTicker
            ));
            if (r.source === 'cache') {
              console.info(`[CACHE] ${r.ticker} -> ${r.selected.dateUsed} / ${r.latest.date}`);
            }
            if (r.source === 'network') {
              console.info(`[NETWORK] ${r.ticker} -> ${r.selected.dateUsed} / ${r.latest.date}`);
            }
            continue;
          }

          // лимит/недоступность → демо
          if (r.rateLimited) {
            const demo = this.makeDemoRow(r.ticker, dateISO, initialInvestmentPerTicker);
            rows.push(demo);
            console.warn(`[DEMO] ${r.ticker}: rate limited, cache missing → using fallback demo`);
            continue;
          }

          // отсутствуют данные по дате → скипаем
          if (r.error?.startsWith('No data on or before')) {
            console.warn(`[SKIP] ${r.ticker}: ${r.error}`);
            continue;
          }

          // пустой/битый CSV или прочее → скип
          console.warn(`[SKIP] ${r.ticker}: ${r.error ?? 'Unknown error'}`);
        }
        return rows;
      })
    );
  }

  // === ВСПОМОГАТЕЛЬНЫЕ ПОТОКИ ===============================================
  getPrices(dateISO: string, tickers: string[]): Observable<BatchResponse> {
    const tasks = tickers.map(t => this.fetchWithCacheOrNetwork(t, dateISO));
    return forkJoin(tasks).pipe(map(results => ({ dateRequested: dateISO, results })));
  }

  // Сначала cache → если нет/битый, тогда сеть; при лимите: demo
  private fetchWithCacheOrNetwork(originalTicker: string, dateISO: string): Observable<TickerResult> {
    // 1) Кеш
    const cached = this.readCache(originalTicker);
    if (cached) {
      const rows = this.parseCsv(cached);
      if (rows.length) {
        const selected = this.findCloseOnOrBefore(rows, dateISO);
        const latest = this.findLatestClose(rows);
        if (selected && latest) {
          return of({ ticker: originalTicker, selected, latest, source: 'cache' });
        }
      }
    }

    // 2) Сеть
    return this.fetchFromNetwork(originalTicker, dateISO).pipe(
      // при сетевой ошибке попробуем всё же вернуть демо (это случается при лимите без явного текста)
      catchError(() => {
        return of({ ticker: originalTicker, error: 'Network failure', rateLimited: true, source: 'demo' as const});
      })
    );
  }

  private fetchFromNetwork(originalTicker: string, dateISO: string): Observable<TickerResult> {
    const stooqSymbol = this.toStooqSymbol(originalTicker); // "BRK.B" -> "brk-b.us"
    const url = `/stooq/q/d/l/?s=${stooqSymbol}&i=d`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      map(text => {
        // Специальные ответы:
        if (/Exceeded the daily hits limit/i.test(text)) {
          // лимит — проверяем кеш ещё раз (на всякий случай уже проверили, но оставим логику здесь)
          const cached = this.readCache(originalTicker);
          if (cached) {
            const rows = this.parseCsv(cached);
            const selected = this.findCloseOnOrBefore(rows, dateISO);
            const latest = this.findLatestClose(rows);
            if (selected && latest) {
              console.warn(`[RATE LIMIT][CACHE USED] ${originalTicker}`);
              return { ticker: originalTicker, selected, latest, source: 'cache' as const };
            }
          }
          // кеша нет → вернём маркер для DEMO
          return { ticker: originalTicker, error: 'Rate limited', rateLimited: true, source: 'demo' as const };
        }

        // Обычный CSV?
        const rows = this.parseCsv(text);
        if (!rows.length) {
          // "No data" или HTML → пусто
          return { ticker: originalTicker, error: 'No data / invalid CSV', source: 'network' as const };
        }

        // Успех -> сохраним в кеш
        this.writeCache(originalTicker, text);

        const selected = this.findCloseOnOrBefore(rows, dateISO);
        const latest = this.findLatestClose(rows);
        if (!selected) return { ticker: originalTicker, error: `No data on or before ${dateISO}`, source: 'network' as const };
        if (!latest) return { ticker: originalTicker, error: 'No latest data', source: 'network' as const };
        return { ticker: originalTicker, selected, latest, source: 'network' as const };
      }),
      catchError(err => {
        const msg = err?.message ?? String(err);
        return of({ ticker: originalTicker, error: `Network/HTTP error: ${msg}`, source: 'network' as const , rateLimited: true });
      })
    );
  }

  // === КЕШ (localStorage на 24ч) ============================================
  private TTL_MS = 24 * 60 * 60 * 1000;
  private LS_KEY(ticker: string) { return `stooq:${this.toStooqSymbol(ticker)}`; }

  private readCache(originalTicker: string): string | null {
    try {
      const raw = localStorage.getItem(this.LS_KEY(originalTicker));
      if (!raw) return null;
      const { ts, csv } = JSON.parse(raw);
      if (Date.now() - ts > this.TTL_MS) return null;
      if (typeof csv !== 'string' || !csv) return null;
      return csv;
    } catch { return null; }
  }

  private writeCache(originalTicker: string, csv: string): void {
    try {
      localStorage.setItem(this.LS_KEY(originalTicker), JSON.stringify({ ts: Date.now(), csv }));
      console.info(`[CACHE WRITE] ${originalTicker}`);
    } catch {
      // ignore quota errors
    }
  }

  // === CSV и поики дат ======================================================
  /** "AAPL" -> "aapl.us"; "BRK.B" -> "brk-b.us" */
  private toStooqSymbol(ticker: string): string {
    return `${ticker.replace(/\./g, '-').toLowerCase()}.us`;
  }

  private parseCsv(text: string): Array<Record<string, string>> {
    const trimmed = (text ?? '').trim();
    if (!trimmed || !trimmed.startsWith('Date,')) {
      // Stooq при отсутствии данных часто отвечает "No data" (голая строка)
      console.warn('Unexpected CSV header. First 120 chars:', trimmed.slice(0, 120));
      return [];
    }
    const lines = trimmed.split(/\r?\n/);
    const header = (lines.shift() ?? '').split(',');
    const out: Array<Record<string, string>> = [];

    for (const line of lines) {
      const cols = line.split(',');
      if (cols.length !== header.length) continue;
      out.push(Object.fromEntries(header.map((h, i) => [h, cols[i]])));
    }
    return out;
  }

  private findCloseOnOrBefore(
    rows: Array<Record<string, string>>,
    dateISO: string
  ): { dateUsed: string; close: number } | null {
    const target = Number(dateISO.replace(/-/g, ''));
    if (!Number.isFinite(target)) return null;

    for (let i = rows.length - 1; i >= 0; i--) {
      const d = rows[i]['Date'];
      const c = rows[i]['Close'];
      const dk = d ? Number(d.replace(/-/g, '')) : NaN;
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

  // === DEMO (на случай полного лимита без кеша) =============================
  private makeDemoRow(ticker: string, buyDateISO: string, amount: number): StockModel {
    const today = new Date().toISOString().slice(0, 10);
    const seed = hashStr(ticker + buyDateISO);     // зависит и от тикера, и от даты
    const buy = 40 + (seed % 361);                // 40..400
    const ret = -0.2 + ((seed * 9301 + 49297) % 1000) / 1000; // ~ -20%..+80%
    const sell = round2(buy * (1 + ret));
    console.warn(`[DEMO BUILD] ${ticker}: buy=${buy.toFixed(2)} sell=${sell.toFixed(2)} date=${buyDateISO}`);
    return buildRow(ticker, buyDateISO, buy, today, sell, amount);
  }
}

// === helpers ================================================================
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

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
