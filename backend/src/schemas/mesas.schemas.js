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

const zonaSchema = z.enum(['Interior', 'Exterior']);
const rotacionSchema = z.number().int().refine(val => [0, 90, 180, 270].includes(val), {
  message: 'La rotación debe ser 0, 90, 180 o 270'
});

const actualizarMesaBodySchema = z.object({
  numero: positiveIntSchema.optional(),
  zona: z.preprocess((val) => (val === '' ? undefined : val), zonaSchema.nullable().optional()),
  capacidad: positiveIntSchema.optional(),
  estado: estadoMesaSchema.optional(),
  activa: booleanOptionalFromString,
  posX: z.number().int().min(0).max(2000).nullable().optional(),
  posY: z.number().int().min(0).max(2000).nullable().optional(),
  rotacion: rotacionSchema.optional()
}).strip();

const cambiarEstadoBodySchema = z.object({
  estado: estadoMesaSchema
}).strip();

const actualizarPosicionesBodySchema = z.object({
  posiciones: z.array(z.object({
    id: positiveIntSchema,
    zona: zonaSchema.nullable(),
    posX: z.number().int().min(0).max(2000).nullable(),
    posY: z.number().int().min(0).max(2000).nullable(),
    rotacion: rotacionSchema.optional()
  }))
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  crearMesaBodySchema,
  actualizarMesaBodySchema,
  cambiarEstadoBodySchema,
  actualizarPosicionesBodySchema
};
