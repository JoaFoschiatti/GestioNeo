jest.mock('nodemailer', () => {
  return {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
    }))
  };
});

const nodemailer = require('nodemailer');

describe('EmailService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.clearAllMocks();
  });

  it('createTransporter devuelve null si faltan credenciales SMTP', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const emailService = require('../services/email.service');
    const transporter = await emailService.createTransporter();

    expect(transporter).toBeNull();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('sendOrderConfirmation crea transporter y envía email cuando hay SMTP_* configuradas', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.EMAIL_FROM = 'no-reply@example.com';

    const emailService = require('../services/email.service');

    const pedido = {
      id: 123,
      clienteEmail: 'cliente@example.com',
      clienteNombre: 'Cliente',
      tipo: 'DELIVERY',
      total: '100',
      costoEnvio: '0',
      estadoPago: 'PENDIENTE',
      items: [
        {
          cantidad: 1,
          subtotal: '100',
          producto: { nombre: 'Producto' }
        }
      ]
    };

    const info = await emailService.sendOrderConfirmation(pedido, { nombre: 'Test Tenant' });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-pass' }
    }));
    expect(info).toEqual({ messageId: 'test-message-id' });
  });

  it('sendVerificationEmail usa FRONTEND_URL y envía email', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.FRONTEND_URL = 'http://frontend.test';

    const emailService = require('../services/email.service');

    await emailService.sendVerificationEmail('test@example.com', 'Juan', 'token-123', 'Mi Restaurante');

    const transporter = nodemailer.createTransport.mock.results[0].value;
    expect(transporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@example.com',
      subject: expect.stringContaining('Mi Restaurante')
    }));

    const html = transporter.sendMail.mock.calls[0][0].html;
    expect(html).toContain('http://frontend.test/verificar-email/token-123');
  });
});
