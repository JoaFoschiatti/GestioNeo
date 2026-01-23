const { z } = require('zod');
const { booleanOptionalFromString, idParamSchema } = require('./common.schemas');

const booleanFromString = z.preprocess((val) => {
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return val;
}, z.boolean());

const listarTenantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.preprocess((val) => (val === '' ? undefined : val), z.string().trim().min(1).optional()),
  activo: booleanOptionalFromString
}).strip();

const toggleActivoBodySchema = z.object({
  activo: booleanFromString
}).strip();

module.exports = {
  idParamSchema,
  listarTenantsQuerySchema,
  toggleActivoBodySchema
};
