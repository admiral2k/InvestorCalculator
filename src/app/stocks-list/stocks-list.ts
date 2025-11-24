import { Component, computed, effect, input } from '@angular/core';
import { StockModel } from '../services/stocks-api';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-stocks-list',
  imports: [CurrencyPipe, DatePipe, DecimalPipe,  NgClass],
  templateUrl: './stocks-list.html',
  styleUrl: './stocks-list.css'
})
export class StocksList {
  stockList = input.required<StockModel[]>();
  animKey   = input(0);
  isLoading = input.required<boolean>();

  play = false;

  // пересчёты для итогов
  totalInitial = computed(() =>
    this.stockList().reduce((a, x) => a + x.initialInvestment, 0)
  );
  totalCurrent = computed(() =>
    this.stockList().reduce((a, x) => a + x.currentValue, 0)
  );
  totalProfit = computed(() =>
    this.stockList().reduce((a, x) => a + x.profit, 0)
  );
  avgReturnPct = computed(() => {
    const arr = this.stockList();
    return arr.length ? arr.reduce((a, x) => a + x.returnPct, 0) / arr.length : 0;
  });

  // перезапуск анимации при каждом animKey
  #replay = effect(() => {
    this.animKey();
    this.play = false;
    requestAnimationFrame(() => { this.play = true; });
  });
}
