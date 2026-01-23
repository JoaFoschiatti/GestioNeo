const { z } = require('zod');
const { positiveIntSchema, idParamSchema } = require('./common.schemas');

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const dateStringSchema = z.string().refine(isValidDate, 'Fecha inválida');

const optionalDateStringSchema = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  dateStringSchema.optional()
);

const empleadoIdParamSchema = z.object({
  empleadoId: positiveIntSchema
});

const listarQuerySchema = z.object({
  empleadoId: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    positiveIntSchema.optional()
  ),
  fechaDesde: optionalDateStringSchema,
  fechaHasta: optionalDateStringSchema
}).strip();

const registrarBodySchema = z.object({
  empleadoId: positiveIntSchema
}).strip();

const calcularHorasQuerySchema = z.object({
  fechaDesde: dateStringSchema,
  fechaHasta: dateStringSchema
}).strip();

const editarBodySchema = z.object({
  entrada: optionalDateStringSchema,
  salida: optionalDateStringSchema
}).strip();

module.exports = {
  idParamSchema,
  empleadoIdParamSchema,
  listarQuerySchema,
  registrarBodySchema,
  calcularHorasQuerySchema,
  editarBodySchema
};
