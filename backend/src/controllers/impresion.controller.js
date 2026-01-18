const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generar contenido de comanda para impresión
const generarContenidoComanda = (pedido, tipo) => {
  const fecha = new Date(pedido.createdAt).toLocaleString('es-AR');
  const lineas = [];

  // Encabezado
  lineas.push('================================');
  lineas.push('         GESTIONEO');
  lineas.push('================================');
  lineas.push('');

  // Tipo de comanda
  if (tipo === 'COCINA') {
    lineas.push('      *** COCINA ***');
  } else if (tipo === 'CAJA') {
    lineas.push('       *** CAJA ***');
  } else {
    lineas.push('    *** COMPROBANTE ***');
  }

  lineas.push('');
  lineas.push(`Pedido #${pedido.id}`);
  lineas.push(`Fecha: ${fecha}`);

  if (pedido.tipo === 'MESA' && pedido.mesa) {
    lineas.push(`Mesa: ${pedido.mesa.numero}`);
  } else if (pedido.tipo === 'DELIVERY') {
    lineas.push('Tipo: DELIVERY');
    if (pedido.clienteNombre) lineas.push(`Cliente: ${pedido.clienteNombre}`);
    if (pedido.clienteTelefono) lineas.push(`Tel: ${pedido.clienteTelefono}`);
    if (pedido.clienteDireccion) lineas.push(`Dir: ${pedido.clienteDireccion}`);
  } else {
    lineas.push('Tipo: MOSTRADOR');
  }

  lineas.push(`Mozo: ${pedido.usuario?.nombre || '-'}`);
  lineas.push('');
  lineas.push('--------------------------------');
  lineas.push('ITEMS:');
  lineas.push('--------------------------------');

  // Items
  for (const item of pedido.items) {
    lineas.push(`${item.cantidad}x ${item.producto?.nombre || 'Producto'}`);
    if (item.observaciones) {
      lineas.push(`   -> ${item.observaciones}`);
    }
    if (tipo !== 'COCINA') {
      lineas.push(`   $${parseFloat(item.subtotal).toFixed(2)}`);
    }
  }

  lineas.push('--------------------------------');

  // Totales (excepto para cocina)
  if (tipo !== 'COCINA') {
    lineas.push(`SUBTOTAL: $${parseFloat(pedido.subtotal).toFixed(2)}`);
    if (parseFloat(pedido.descuento) > 0) {
      lineas.push(`DESCUENTO: -$${parseFloat(pedido.descuento).toFixed(2)}`);
    }
    lineas.push(`TOTAL: $${parseFloat(pedido.total).toFixed(2)}`);
  }

  if (pedido.observaciones) {
    lineas.push('');
    lineas.push('OBSERVACIONES:');
    lineas.push(pedido.observaciones);
  }

  lineas.push('');
  lineas.push('================================');

  if (tipo === 'CLIENTE') {
    lineas.push('   Gracias por su compra!');
  }

  lineas.push('');
  lineas.push('');
  lineas.push('');

  return lineas.join('\n');
};

// Imprimir comanda (genera contenido para las 3 impresiones)
const imprimirComanda = async (req, res) => {
  try {
    const { pedidoId } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(pedidoId) },
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: { select: { nombre: true } } } }
      }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    // Generar contenido para las 3 comandas
    const comandas = {
      cocina: generarContenidoComanda(pedido, 'COCINA'),
      caja: generarContenidoComanda(pedido, 'CAJA'),
      cliente: generarContenidoComanda(pedido, 'CLIENTE')
    };

    // Marcar como impreso
    await prisma.pedido.update({
      where: { id: parseInt(pedidoId) },
      data: { impreso: true }
    });

    // TODO: Integrar con impresora térmica real usando node-thermal-printer
    // Por ahora retornamos el contenido para preview/test

    res.json({
      success: true,
      message: 'Comandas generadas correctamente',
      comandas,
      nota: 'Para imprimir realmente, conectar impresora térmica ESC/POS'
    });
  } catch (error) {
    console.error('Error al imprimir comanda:', error);
    res.status(500).json({ error: { message: 'Error al generar comanda' } });
  }
};

// Preview de comanda (sin marcar como impreso)
const previewComanda = async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { tipo } = req.query; // COCINA, CAJA, CLIENTE

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(pedidoId) },
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: { select: { nombre: true } } } }
      }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    const contenido = generarContenidoComanda(pedido, tipo || 'CLIENTE');

    res.type('text/plain').send(contenido);
  } catch (error) {
    console.error('Error al generar preview:', error);
    res.status(500).json({ error: { message: 'Error al generar preview' } });
  }
};

// Estado de la impresora (mock)
const estadoImpresora = async (req, res) => {
  // TODO: Implementar verificación real del estado de la impresora
  res.json({
    conectada: false,
    mensaje: 'Impresora no configurada. Conectar impresora térmica USB.',
    instrucciones: [
      '1. Conectar impresora térmica por USB',
      '2. Instalar driver si es necesario',
      '3. Configurar nombre/puerto en .env',
      '4. Reiniciar el servidor'
    ]
  });
};

// Reimprimir comanda
const reimprimirComanda = async (req, res) => {
  // Usa la misma lógica que imprimirComanda
  return imprimirComanda(req, res);
};

module.exports = {
  imprimirComanda,
  previewComanda,
  estadoImpresora,
  reimprimirComanda
};
