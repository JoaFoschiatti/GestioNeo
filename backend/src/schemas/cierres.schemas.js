const { z } = require('zod');
const { positiveIntSchema, idParamSchema } = require('./common.schemas');

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const dateStringSchema = z.string().refine(isValidDate, 'Fecha inválida');

const listarQuerySchema = z.object({
  fechaDesde: dateStringSchema.optional(),
  fechaHasta: dateStringSchema.optional(),
  limit: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    positiveIntSchema.max(200).optional()
  )
}).strip();

const abrirCajaBodySchema = z.object({
  fondoInicial: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0)
  )
}).strip();

const cerrarCajaBodySchema = z.object({
  efectivoFisico: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0)
  ),
  observaciones: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional())
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  abrirCajaBodySchema,
  cerrarCajaBodySchema
};
