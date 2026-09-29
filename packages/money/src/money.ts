import { Decimal } from './decimal.js';

export interface MoneyProps {
  amount: number | string | Decimal;
  currency?: string;
}

export class Money {
  private readonly _amount: Decimal;
  private readonly _currency: string;

  constructor(amount: number | string | Decimal, currency: string = 'EGP') {
    this._amount = new Decimal(amount);
    this._currency = currency.toUpperCase();
  }

  public static from(amount: number | string | Decimal, currency: string = 'EGP'): Money {
    return new Money(amount, currency);
  }

  public static zero(currency: string = 'EGP'): Money {
    return new Money(0, currency);
  }

  public get amount(): Decimal {
    return this._amount;
  }

  public get currency(): string {
    return this._currency;
  }

  public toNumber(): number {
    return this._amount.toNumber();
  }

  public toFixed(decimalPlaces: number = 2): string {
    return this._amount.toFixed(decimalPlaces);
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount.plus(other._amount), this._currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount.minus(other._amount), this._currency);
  }

  public multiply(factor: number | string | Decimal): Money {
    return new Money(this._amount.times(new Decimal(factor)), this._currency);
  }

  public divide(divisor: number | string | Decimal): Money {
    const d = new Decimal(divisor);
    if (d.isZero()) {
      throw new Error('Division by zero');
    }
    return new Money(this._amount.dividedBy(d), this._currency);
  }

  public equals(other: Money): boolean {
    return this._currency === other._currency && this._amount.equals(other._amount);
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount.greaterThan(other._amount);
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount.lessThan(other._amount);
  }

  public isZero(): boolean {
    return this._amount.isZero();
  }

  public isPositive(): boolean {
    return this._amount.greaterThan(0);
  }

  public isNegative(): boolean {
    return this._amount.lessThan(0);
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`Currency mismatch: cannot operate on ${this._currency} and ${other._currency}`);
    }
  }

  public toString(): string {
    return this._amount.toString();
  }

  public toJSON() {
    return {
      amount: this.toNumber(),
      formatted: this.toFixed(2),
      currency: this._currency,
    };
  }
}
