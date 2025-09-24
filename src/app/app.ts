import { Component, signal } from '@angular/core';
import { Header } from "./header/header";
import { InvestmentForm } from "./investment-form/investment-form";
@Component({
  selector: 'app-root',
  imports: [Header, InvestmentForm],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('investor-calculator');
}
