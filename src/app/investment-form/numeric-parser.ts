import { Injectable } from "@angular/core";

@Injectable({providedIn: 'root'})
export class NumericParser {
    clearNumericInput(raw: string) {
        const numeric = parseFloat(raw.replace(/[^0-9.]/g, ''));
        return isNaN(numeric) ? 0 : numeric;
    }
}