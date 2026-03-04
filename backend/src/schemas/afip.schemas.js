const { z } = require('zod');

const configurarFiscalBodySchema = z.object({
  cuit: z.string().regex(/^\d{2}-\d{8}-\d{1}$/, 'CUIT debe tener formato XX-XXXXXXXX-X').optional(),
  razonSocial: z.string().min(2).max(200).optional(),
  condicionIva: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO']).optional(),
  puntoVenta: z.coerce.number().int().min(1).max(99999).optional(),
  domicilioFiscal: z.string().max(300).optional(),
  iibb: z.string().max(30).optional(),
  inicioActividades: z.string().optional()
}).strip();

const toggleModoBodySchema = z.object({
  produccion: z.boolean()
}).strip();

const generarCsrBodySchema = z.object({
  cuit: z.string().regex(/^\d{2}-\d{8}-\d{1}$/, 'CUIT debe tener formato XX-XXXXXXXX-X'),
  alias: z.string().min(1).max(100),
  razonSocial: z.string().min(2).max(200).optional()
}).strip();

module.exports = {
  configurarFiscalBodySchema,
  toggleModoBodySchema,
  generarCsrBodySchema
};
