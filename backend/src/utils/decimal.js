/**
 * Utilidades para aritmética monetaria segura.
 * Evita errores de punto flotante usando Math.round con centavos.
 */

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value.toNumber === 'function') return value.toNumber();
  if (typeof value.toString === 'function') return parseFloat(value.toString()) || 0;
  return Number(value) || 0;
};

/** Round to 2 decimal places to avoid floating-point drift */
const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;

/** Sum multiple monetary values safely */
const sumMoney = (...values) => roundMoney(values.reduce((sum, v) => sum + toNumber(v), 0));

/** Multiply price * quantity safely */
const multiplyMoney = (price, quantity) => roundMoney(toNumber(price) * toNumber(quantity));

/** Subtract b from a safely */
const subtractMoney = (a, b) => roundMoney(toNumber(a) - toNumber(b));

module.exports = { decimalToNumber: toNumber, toNumber, roundMoney, sumMoney, multiplyMoney, subtractMoney };
