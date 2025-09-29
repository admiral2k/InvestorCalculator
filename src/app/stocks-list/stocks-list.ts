import { Component, effect, input, signal, SimpleChanges } from '@angular/core';
import { StockModel } from '../services/stocks-api';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';


@Component({
  selector: 'app-stocks-list',
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './stocks-list.html',
  styleUrl: './stocks-list.css'
})
export class StocksList {
  stockList = input.required<StockModel[]>();
  animKey = input(0);
  isLoading = input.required<boolean>();

  play = false;

  #replay = effect(() => {
    this.animKey();
    this.play = false;
    requestAnimationFrame(() => { this.play = true; });
  });
}