const { z } = require('zod');
const { positiveIntSchema, idParamSchema } = require('./common.schemas');

const listarQuerySchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO', 'CANCELADO']).optional(),
  tipo: z.enum(['MESA', 'DELIVERY', 'MOSTRADOR']).optional(),
  fecha: z.string().min(1).optional(),
  mesaId: positiveIntSchema.optional()
}).strip();

const pedidoItemInputSchema = z.object({
  productoId: positiveIntSchema,
  cantidad: positiveIntSchema,
  observaciones: z.string().max(500).optional(),
  modificadores: z.array(positiveIntSchema).optional()
}).strip();

const crearPedidoBodySchema = z.object({
  tipo: z.enum(['MESA', 'DELIVERY', 'MOSTRADOR']),
  mesaId: positiveIntSchema.optional().nullable(),
  items: z.array(pedidoItemInputSchema).min(1),
  clienteNombre: z.string().max(150).optional(),
  clienteTelefono: z.string().max(60).optional(),
  clienteDireccion: z.string().max(250).optional(),
  observaciones: z.string().max(500).optional()
}).strip();

const cambiarEstadoBodySchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO', 'CANCELADO'])
}).strip();

const agregarItemsBodySchema = z.object({
  items: z.array(pedidoItemInputSchema.omit({ modificadores: true })).min(1)
}).strip();

const cancelarBodySchema = z.object({
  motivo: z.string().max(500).optional()
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  crearPedidoBodySchema,
  cambiarEstadoBodySchema,
  agregarItemsBodySchema,
  cancelarBodySchema
};
