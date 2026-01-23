const { z } = require('zod');
const { booleanOptionalFromString, positiveIntSchema, idParamSchema } = require('./common.schemas');

const estadoMesaSchema = z.enum(['LIBRE', 'OCUPADA', 'RESERVADA']);

const listarQuerySchema = z.object({
  estado: estadoMesaSchema.optional(),
  activa: booleanOptionalFromString
}).strip();

const crearMesaBodySchema = z.object({
  numero: positiveIntSchema,
  zona: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  capacidad: positiveIntSchema.optional()
}).strip();

const actualizarMesaBodySchema = z.object({
  numero: positiveIntSchema.optional(),
  zona: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  capacidad: positiveIntSchema.optional(),
  estado: estadoMesaSchema.optional(),
  activa: booleanOptionalFromString
}).strip();

const cambiarEstadoBodySchema = z.object({
  estado: estadoMesaSchema
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  crearMesaBodySchema,
  actualizarMesaBodySchema,
  cambiarEstadoBodySchema
};
