const decimalToNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (typeof value.toNumber === 'function') return value.toNumber();
  if (typeof value.toString === 'function') return parseFloat(value.toString());
  return Number(value);
};

module.exports = { decimalToNumber };

