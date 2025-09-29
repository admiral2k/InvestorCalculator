import { Component, signal } from '@angular/core';
import { Header } from "./header/header";
import { InvestmentForm } from "./investment-form/investment-form";
import { StocksList } from "./stocks-list/stocks-list";
import { StockModel } from './services/stocks-api';

@Component({
  selector: 'app-root',
  imports: [Header, InvestmentForm, StocksList],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('investor-calculator');
  stockList: StockModel[] = []
  animKey = signal(0);
  isLoading = signal(false);

  onEstimateStocks(stocks: StockModel[]) {
    this.stockList = stocks;
    this.animKey.update(v => v + 1);
  }

  changeLoadingState(isLoadingValue: boolean) {
      this.isLoading.set(isLoadingValue);
      console.log("Changed state to" + isLoadingValue)
  }
}
