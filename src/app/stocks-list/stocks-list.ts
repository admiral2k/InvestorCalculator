import { Component, effect, input, SimpleChanges } from '@angular/core';
import { StockModel } from '../services/stocks-api';


@Component({
  selector: 'app-stocks-list',
  imports: [],
  templateUrl: './stocks-list.html',
  styleUrl: './stocks-list.css'
})
export class StocksList {
  stockList = input.required<StockModel[]>();
  animKey = input(0);

  play = false;   

  #replay = effect(() => {
    this.animKey();             
    this.play = false;          
    requestAnimationFrame(() => { this.play = true; }); 
  });
}