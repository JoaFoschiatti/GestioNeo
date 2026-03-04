const { z } = require('zod');
const { positiveIntSchema, idParamSchema } = require('./common.schemas');

const estadoReservaSchema = z.enum(['CONFIRMADA', 'CLIENTE_PRESENTE', 'NO_LLEGO', 'CANCELADA']);

const dateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), 'Fecha inválida');

const listarQuerySchema = z.object({
  fecha: dateOnlySchema.optional(),
  mesaId: positiveIntSchema.optional(),
  estado: estadoReservaSchema.optional()
}).strip();

const optionalNullableString = z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional());

const crearReservaBodySchema = z.object({
  mesaId: positiveIntSchema,
  clienteNombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  clienteTelefono: optionalNullableString,
  fechaHora: z.coerce.date(),
  cantidadPersonas: positiveIntSchema,
  observaciones: optionalNullableString
}).strip();

const actualizarReservaBodySchema = z.object({
  clienteNombre: z.string().min(1).optional(),
  clienteTelefono: optionalNullableString,
  fechaHora: z.coerce.date().optional(),
  cantidadPersonas: positiveIntSchema.optional(),
  observaciones: optionalNullableString
}).strip();

const cambiarEstadoBodySchema = z.object({
  estado: estadoReservaSchema
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  crearReservaBodySchema,
  actualizarReservaBodySchema,
  cambiarEstadoBodySchema
};
