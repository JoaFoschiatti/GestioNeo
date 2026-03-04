const { z } = require('zod');
const { booleanOptionalFromString, idParamSchema } = require('./common.schemas');

const rolEmpleadoSchema = z.enum(['ADMIN', 'MOZO', 'COCINERO', 'CAJERO', 'DELIVERY']);

const listarQuerySchema = z.object({
  activo: booleanOptionalFromString,
  rol: rolEmpleadoSchema.optional()
}).strip();

const crearEmpleadoBodySchema = z.object({
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  apellido: z.string({ required_error: 'Apellido es requerido' }).min(1, 'Apellido es requerido'),
  dni: z.string({ required_error: 'DNI es requerido' }).min(1, 'DNI es requerido'),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  rol: rolEmpleadoSchema,
  tarifaHora: z.coerce.number().min(0)
}).strip();

const actualizarEmpleadoBodySchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  dni: z.string().min(1).optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  rol: rolEmpleadoSchema.optional(),
  tarifaHora: z.coerce.number().min(0).optional(),
  activo: booleanOptionalFromString
}).strip();

module.exports = {
  rolEmpleadoSchema,
  idParamSchema,
  listarQuerySchema,
  crearEmpleadoBodySchema,
  actualizarEmpleadoBodySchema
};
