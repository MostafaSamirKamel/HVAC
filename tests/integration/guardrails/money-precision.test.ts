import { describe, it, expect } from 'vitest';
import { Money } from '@hvac/money';

describe('Phase 0 Guardrail: Financial Precision & Zero Floating Point Drift', () => {
  it('should correctly sum fractional amounts without IEEE-754 binary floating errors (0.1 + 0.2 = 0.3)', () => {
    // Standard JS: 0.1 + 0.2 = 0.30000000000000004
    const m1 = Money.from(0.1, 'EGP');
    const m2 = Money.from(0.2, 'EGP');
    const total = m1.add(m2);

    expect(total.toNumber()).toBe(0.3);
    expect(total.toFixed(2)).toBe('0.30');
  });

  it('should accurately calculate monthly installment payments with exact division', () => {
    // Financed 10,000 EGP over 3 installments
    const totalFinanced = Money.from(10000, 'EGP');
    const monthlyRate = totalFinanced.divide(3);

    // 10000 / 3 = 3333.333333...
    expect(monthlyRate.toFixed(2)).toBe('3333.33');

    // Multiply back and reconcile rounding remainder
    const sumThree = monthlyRate.multiply(3);
    const difference = totalFinanced.subtract(sumThree);

    // Difference must be accurately captured as 0.01 or exact balance
    expect(difference.amount.greaterThanOrEqualTo(0)).toBe(true);
  });

  it('should reject arithmetic on mismatched currencies', () => {
    const egp = Money.from(100, 'EGP');
    const usd = Money.from(100, 'USD');

    expect(() => egp.add(usd)).toThrow(/Currency mismatch/);
  });
});
