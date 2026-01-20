const nodemailer = require('nodemailer');
const { prisma, getTenantPrisma } = require('../db/prisma');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async getConfig(tenantId = null) {
    let query;

    if (tenantId) {
      const tenantPrisma = getTenantPrisma(tenantId);
      query = tenantPrisma.configuracion.findMany({
        where: {
          clave: {
            in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'email_from', 'nombre_negocio']
          }
        }
      });
    } else {
      query = prisma.configuracion.findMany({
        where: {
          clave: {
            in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'email_from', 'nombre_negocio']
          }
        },
        take: 6
      });
    }

    const configs = await query;
    return Object.fromEntries(configs.map(c => [c.clave, c.valor]));
  }

  async createTransporter() {
    // Usar variables de entorno si existen, sino de configuración
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.log('Email service: Credenciales SMTP no configuradas');
      return null;
    }

    return nodemailer.createTransporter({
      host,
      port: parseInt(port) || 587,
      secure: port === '465',
      auth: {
        user,
        pass
      }
    });
  }

  async sendOrderConfirmation(pedido, tenant = null) {
    try {
      if (!pedido.clienteEmail) {
        console.log('Email service: Pedido sin email, saltando envío');
        return null;
      }

      const transporter = await this.createTransporter();
      if (!transporter) {
        console.log('Email service: Transporter no disponible');
        return null;
      }

      const nombreNegocio = tenant?.nombre || 'GestioNeo';
      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'pedidos@gestioneo.com';

      const html = this.generateOrderEmailHTML(pedido, nombreNegocio, tenant);

      const info = await transporter.sendMail({
        from: `"${nombreNegocio}" <${fromEmail}>`,
        to: pedido.clienteEmail,
        subject: `Confirmación de Pedido #${pedido.id} - ${nombreNegocio}`,
        html
      });

      console.log('Email enviado:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error al enviar email:', error);
      return null;
    }
  }

  generateOrderEmailHTML(pedido, nombreNegocio, tenant = null) {
    const primaryColor = tenant?.colorPrimario || '#eb7615';

    const itemsHTML = pedido.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.cantidad}x ${item.producto?.nombre || 'Producto'}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          $${parseFloat(item.subtotal).toLocaleString('es-AR')}
        </td>
      </tr>
    `).join('');

    const costoEnvio = parseFloat(pedido.costoEnvio) || 0;
    const total = parseFloat(pedido.total) + costoEnvio;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${primaryColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
          .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .total-row { font-weight: bold; font-size: 1.2em; background: #f5f5f5; }
          .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 0.9em; }
          .status-pendiente { background: #fff3cd; color: #856404; }
          .status-aprobado { background: #d4edda; color: #155724; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">¡Gracias por tu pedido!</h1>
            <p style="margin: 10px 0 0 0;">${nombreNegocio}</p>
          </div>

          <div class="content">
            <p>Hola <strong>${pedido.clienteNombre}</strong>,</p>
            <p>Tu pedido <strong>#${pedido.id}</strong> ha sido recibido correctamente.</p>

            <h3>Detalle del Pedido</h3>
            <table class="order-table">
              <tbody>
                ${itemsHTML}
                ${costoEnvio > 0 ? `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">Costo de envío</td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${costoEnvio.toLocaleString('es-AR')}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                  <td style="padding: 15px;">TOTAL</td>
                  <td style="padding: 15px; text-align: right; color: ${primaryColor};">$${total.toLocaleString('es-AR')}</td>
                </tr>
              </tbody>
            </table>

            <p><strong>Tipo de entrega:</strong> ${pedido.tipoEntrega === 'DELIVERY' ? 'Delivery' : 'Retiro en local'}</p>
            ${pedido.tipoEntrega === 'DELIVERY' && pedido.clienteDireccion ? `
            <p><strong>Dirección:</strong> ${pedido.clienteDireccion}</p>
            ` : ''}

            <p>
              <strong>Estado del pago:</strong>
              <span class="status status-${pedido.estadoPago?.toLowerCase() || 'pendiente'}">
                ${pedido.estadoPago === 'APROBADO' ? 'Pagado' : 'Pendiente'}
              </span>
            </p>

            ${pedido.observaciones ? `
            <p><strong>Observaciones:</strong> ${pedido.observaciones}</p>
            ` : ''}
          </div>

          <div class="footer">
            <p>Este es un comprobante de tu pedido. Guárdalo para futuras referencias.</p>
            <p>${nombreNegocio}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send verification email for new tenant registration
   */
  async sendVerificationEmail(email, nombre, token, nombreRestaurante) {
    try {
      const transporter = await this.createTransporter();
      if (!transporter) {
        console.log('Email service: Transporter no disponible para verificación');
        return null;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const verificationUrl = `${frontendUrl}/verificar-email/${token}`;
      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@gestioneo.com';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3B82F6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .button:hover { background: #2563EB; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
            .note { background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Verifica tu cuenta</h1>
              <p style="margin: 10px 0 0 0;">GestioNeo</p>
            </div>

            <div class="content">
              <p>Hola <strong>${nombre}</strong>,</p>
              <p>Gracias por registrar <strong>${nombreRestaurante}</strong> en GestioNeo.</p>
              <p>Para activar tu cuenta y comenzar a usar el sistema, por favor verifica tu email haciendo clic en el siguiente botón:</p>

              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button" style="color: white;">Verificar mi cuenta</a>
              </div>

              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; color: #3B82F6;">${verificationUrl}</p>

              <div class="note">
                <p style="margin: 0;"><strong>Nota:</strong> Este enlace expirará en 24 horas.</p>
              </div>
            </div>

            <div class="footer">
              <p>Si no solicitaste esta cuenta, puedes ignorar este email.</p>
              <p>GestioNeo - Sistema POS para restaurantes</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const info = await transporter.sendMail({
        from: `"GestioNeo" <${fromEmail}>`,
        to: email,
        subject: `Verifica tu cuenta - ${nombreRestaurante}`,
        html
      });

      console.log('Email de verificación enviado:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error al enviar email de verificación:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const transporter = await this.createTransporter();
      if (!transporter) return { success: false, message: 'Credenciales no configuradas' };

      await transporter.verify();
      return { success: true, message: 'Conexión exitosa' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
