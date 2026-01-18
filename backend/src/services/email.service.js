const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async getConfig() {
    const configs = await prisma.configuracion.findMany({
      where: {
        clave: {
          in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'email_from', 'nombre_negocio']
        }
      }
    });
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

  async sendOrderConfirmation(pedido) {
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

      const config = await this.getConfig();
      const nombreNegocio = config.nombre_negocio || 'GestioNeo';
      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'pedidos@gestioneo.com';

      const html = this.generateOrderEmailHTML(pedido, nombreNegocio);

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

  generateOrderEmailHTML(pedido, nombreNegocio) {
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
          .header { background: #eb7615; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
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
                  <td style="padding: 15px; text-align: right; color: #eb7615;">$${total.toLocaleString('es-AR')}</td>
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
