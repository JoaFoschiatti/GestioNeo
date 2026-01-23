const { prisma } = require('../db/prisma');
const registroService = require('../services/registro.service');
const emailService = require('../services/email.service');

const registrar = async (req, res) => {
  const { tenant, verification } = await registroService.registrar(prisma, req.body);

  try {
    await emailService.sendVerificationEmail(
      verification.email,
      verification.nombre,
      verification.token,
      verification.nombreRestaurante
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error sending verification email:', error);
  }

  res.status(201).json({
    message: 'Registro exitoso. Por favor verifica tu email para activar la cuenta.',
    tenant
  });
};

const verificarEmail = async (req, res) => {
  const resultado = await registroService.verificarEmail(prisma, req.params.token);
  res.json(resultado);
};

const reenviarVerificacion = async (req, res) => {
  const resultado = await registroService.reenviarVerificacion(prisma, req.body.email);

  if (resultado.shouldSendEmail) {
    try {
      await emailService.sendVerificationEmail(
        resultado.verification.email,
        resultado.verification.nombre,
        resultado.verification.token,
        resultado.verification.nombreRestaurante
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error sending verification email:', error);
    }
  }

  res.json({ message: resultado.message });
};

const verificarSlug = async (req, res) => {
  const resultado = await registroService.verificarSlug(prisma, req.params.slug);
  res.json(resultado);
};

module.exports = {
  registrar,
  verificarEmail,
  reenviarVerificacion,
  verificarSlug
};

