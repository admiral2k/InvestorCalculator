import { CurrencyPipe } from '@angular/common';
import { Component, signal, WritableSignal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumericParser } from './numeric-parser';

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
  numericParser = inject(NumericParser)
  InvestmentType = InvestmentType; // to get access in HTML

  enteredStartingDate = signal("")
  selectedInvestmentType = signal<InvestmentType>(InvestmentType.Lump)
  enteredInitialInvestmentAmount = signal(10000);
  enteredRecurringContribution = signal(100)

  onAmountChange(value: string, signalToChange: WritableSignal<Number>) {
    signalToChange.set(this.numericParser.clearNumericInput(value));
  }

  onSubmit() {
    console.log('Selected starting date:', this.enteredStartingDate());
    console.log('Selected type:', this.selectedInvestmentType());
    console.log('Selected initial investment amount:', this.enteredInitialInvestmentAmount());
    console.log('Selected recurring contribution:', this.enteredRecurringContribution());
  }
}
