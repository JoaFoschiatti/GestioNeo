const { z } = require('zod');

const booleanOptionalFromString = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return val;
}, z.boolean().optional());

const positiveIntSchema = z.coerce.number().int().positive();

const idParamSchema = z.object({
  id: positiveIntSchema
});

module.exports = {
  booleanOptionalFromString,
  positiveIntSchema,
  idParamSchema
};

