const { z } = require('zod');
const { booleanOptionalFromString, positiveIntSchema, idParamSchema } = require('./common.schemas');

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const dateStringSchema = z.string().refine(isValidDate, 'Fecha inválida');

const listarQuerySchema = z.object({
  empleadoId: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    positiveIntSchema.optional()
  ),
  pagado: booleanOptionalFromString
}).strip();

const calcularBodySchema = z.object({
  empleadoId: positiveIntSchema,
  fechaDesde: dateStringSchema,
  fechaHasta: dateStringSchema
}).strip();

const crearBodySchema = z.object({
  empleadoId: positiveIntSchema,
  periodoDesde: dateStringSchema,
  periodoHasta: dateStringSchema,
  horasTotales: z.coerce.number().positive(),
  descuentos: z.preprocess((val) => (val === '' || val === null ? 0 : val), z.coerce.number().min(0).optional()),
  adicionales: z.preprocess((val) => (val === '' || val === null ? 0 : val), z.coerce.number().min(0).optional()),
  observaciones: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional())
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  calcularBodySchema,
  crearBodySchema
};
