import { CurrencyPipe } from '@angular/common';
import { Component, signal, WritableSignal, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumericParser } from '../services/numeric-parser';
import { StockModel, StocksService } from '../services/stocks-api';

import { finalize, catchError, of } from 'rxjs';


export enum InvestmentType {
  Lump = 'LUMP',
  Recurring = 'RECURRING'
}

@Component({
  selector: 'app-investment-form',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './investment-form.html',
  styleUrl: './investment-form.css'
})
export class InvestmentForm {
  stocks = inject(StocksService)
  numericParser = inject(NumericParser)
  InvestmentType = InvestmentType; // to get access in HTML

  enteredStartingDate = signal("")
  selectedInvestmentType = signal<InvestmentType>(InvestmentType.Lump)
  enteredInitialInvestmentAmount = signal(10000);
  enteredRecurringContribution = signal(100)

  estimate = output<StockModel[]>()
  loading = output<boolean>()

  onAmountChange(value: string, signalToChange: WritableSignal<number>) {
    signalToChange.set(this.numericParser.clearNumericInput(value));
  }

  onSubmit() {
    this.loading.emit(true)

    console.log('Selected starting date:', this.enteredStartingDate());
    console.log('Selected type:', this.selectedInvestmentType());
    console.log('Selected initial investment amount:', this.enteredInitialInvestmentAmount());
    console.log('Selected recurring contribution:', this.enteredRecurringContribution());

    const date = this.enteredStartingDate();
    const perTicker = this.enteredInitialInvestmentAmount();


this.stocks.getStocksTableSimple(date, perTicker)
  .pipe(
    catchError(err => {
      console.error('API error:', err);
      return of([]); // сервис всё равно соберёт строки (демо для проблемных)
    }),
    finalize(() => this.loading.emit(false))
  )
  .subscribe(rows => {
    this.estimate.emit(rows);
  });
  
    setTimeout(() => {
      const el = document.getElementById('stocks-list');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
  }
}
