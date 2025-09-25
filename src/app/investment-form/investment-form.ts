import { CurrencyPipe } from '@angular/common';
import { Component, effect, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  InvestmentType = InvestmentType; // to get access in HTML
  selectedInvestmentType = signal<InvestmentType>(InvestmentType.Lump)

  enteredStartingDate = signal("")
  enteredInitialInvestmentAmount = signal(10000);
  enteredRecurringContribution = signal(100)

  // Clear input ans save
  onAmountChange(value: string, signalToChange: WritableSignal<Number>) {
    const numeric = parseFloat(value.replace(/[^0-9.]/g, ''));
    signalToChange.set(isNaN(numeric) ? 0 : numeric);
  }


  onSubmit() {
    console.log('Selected starting date:', this.enteredStartingDate());
    console.log('Selected type:', this.selectedInvestmentType());
    console.log('Selected initial investment amount:', this.enteredInitialInvestmentAmount());
    console.log('Selected recurring contribution:', this.enteredRecurringContribution());
  }
}
