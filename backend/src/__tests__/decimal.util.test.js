const { decimalToNumber } = require('../utils/decimal');

describe('decimalToNumber', () => {
  it('retorna 0 para null o undefined', () => {
    expect(decimalToNumber(null)).toBe(0);
    expect(decimalToNumber(undefined)).toBe(0);
  });

  it('convierte numeros y strings', () => {
    expect(decimalToNumber(12.5)).toBe(12.5);
    expect(decimalToNumber('10.25')).toBe(10.25);
  });

  it('usa toNumber cuando existe', () => {
    const value = { toNumber: () => 7.5 };
    expect(decimalToNumber(value)).toBe(7.5);
  });

  it('usa toString como fallback', () => {
    const value = { toString: () => '8.75' };
    expect(decimalToNumber(value)).toBe(8.75);
  });
});
