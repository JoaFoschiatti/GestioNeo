const { z } = require('zod');
const { positiveIntSchema, idParamSchema } = require('./common.schemas');

const pedidoPublicoItemSchema = z.object({
  productoId: positiveIntSchema,
  cantidad: positiveIntSchema
}).strip();

const crearPedidoPublicoBodySchema = z.object({
  items: z.array(pedidoPublicoItemSchema).min(1),
  clienteNombre: z.string().trim().min(2).max(150),
  clienteTelefono: z.string().trim().min(6).max(60),
  clienteDireccion: z.string().trim().max(250).optional(),
  clienteEmail: z.preprocess((val) => (val === '' ? undefined : val), z.string().trim().email('Email inválido').optional()),
  tipoEntrega: z.enum(['DELIVERY', 'RETIRO']),
  metodoPago: z.enum(['EFECTIVO', 'MERCADOPAGO']),
  montoAbonado: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.coerce.number().positive().optional()),
  observaciones: z.string().trim().max(500).optional()
}).strip();

const pedidoPublicoIdParamSchema = idParamSchema;

const pedidoPublicoAccessTokenQuerySchema = z.object({
  token: z.string().min(20, 'Token requerido')
}).strip();

module.exports = {
  crearPedidoPublicoBodySchema,
  pedidoPublicoIdParamSchema,
  pedidoPublicoAccessTokenQuerySchema
};
