/**
 * Servicio de Transferencias Entrantes de MercadoPago
 * Maneja la detección y matching automático de transferencias al CVU/Alias
 */

const { prisma } = require('../db/prisma');
const { getMercadoPagoClient } = require('./mercadopago.service');
const { eventBus } = require('./event-bus');
const logger = require('../utils/logger');

// Ventana de tiempo para matching (24 horas)
const MATCH_WINDOW_HOURS = 24;

/**
 * Obtiene información de la cuenta MP (CVU, Alias)
 * @returns {Promise<object|null>}
 */
async function getAccountInfo() {
  const client = await getMercadoPagoClient();
  if (!client) return null;

  try {
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: {
        'Authorization': `Bearer ${client.accessToken}`
      }
    });

    if (!response.ok) {
      logger.error('Error obteniendo info de cuenta MP:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      userId: data.id,
      email: data.email,
      cvu: data.cvu?.cvu || null,
      alias: data.cvu?.alias || null,
      firstName: data.first_name,
      lastName: data.last_name
    };
  } catch (error) {
    logger.error('Error en getAccountInfo:', error);
    return null;
  }
}

/**
 * Obtiene movimientos de cuenta desde MercadoPago
 * @param {Date} desde - Fecha inicio
 * @param {Date} hasta - Fecha fin (opcional, default: ahora)
 * @returns {Promise<Array>}
 */
async function getAccountMovements(desde, hasta = new Date()) {
  const client = await getMercadoPagoClient();
  if (!client) {
    throw new Error('MercadoPago no está configurado');
  }

  try {
    const params = new URLSearchParams({
      begin_date: desde.toISOString(),
      end_date: hasta.toISOString(),
      limit: '50',
      offset: '0'
    });

    const response = await fetch(
      `https://api.mercadopago.com/v1/account/movements?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${client.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error obteniendo movimientos MP:', error);
      throw new Error(`Error API MercadoPago: ${response.status}`);
    }

    const data = await response.json();

    // Filtrar solo transferencias entrantes (money_transfer, bank_transfer)
    const transferencias = (data.results || []).filter(mov =>
      mov.type === 'money_transfer' ||
      mov.type === 'bank_transfer' ||
      mov.type === 'transfer' ||
      (mov.type === 'payment' && mov.action === 'money_transfer')
    );

    return transferencias;
  } catch (error) {
    logger.error('Error en getAccountMovements:', error);
    throw error;
  }
}

/**
 * Obtiene detalles de un movimiento específico
 * @param {string} movementId
 * @returns {Promise<object>}
 */
async function getMovementDetails(movementId) {
  const client = await getMercadoPagoClient();
  if (!client) {
    throw new Error('MercadoPago no está configurado');
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/account/movements/${movementId}`,
    {
      headers: {
        'Authorization': `Bearer ${client.accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Error obteniendo movimiento ${movementId}: ${response.status}`);
  }

  return response.json();
}

/**
 * Parsea el concepto buscando número de pedido
 * Formatos soportados: #123, PEDIDO 123, PEDIDO#123, PED123
 * @param {string} concept
 * @returns {number|null}
 */
function parseConceptForPedidoId(concept) {
  if (!concept) return null;

  const normalizado = concept.toUpperCase().trim();

  // Patrones a buscar
  const patterns = [
    /#(\d+)/,                    // #123
    /PEDIDO\s*#?(\d+)/i,         // PEDIDO 123 o PEDIDO#123
    /PED\s*#?(\d+)/i,            // PED123 o PED #123
    /ORDEN\s*#?(\d+)/i,          // ORDEN 123
    /^(\d+)$/                    // Solo número
  ];

  for (const pattern of patterns) {
    const match = normalizado.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Busca pagos pendientes de TRANSFERENCIA para matching
 * @param {number} monto
 * @param {number|null} pedidoIdFromConcept
 * @returns {Promise<Array>} Array de pedidos con sus pagos pendientes
 */
async function findCandidatePedidos(monto, pedidoIdFromConcept = null) {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - MATCH_WINDOW_HOURS);

  const montoNum = parseFloat(monto);
  const tolerancia = 0.01; // 1 centavo de tolerancia

  // Buscar pagos pendientes de transferencia con monto coincidente
  const pagosWhere = {
    metodo: 'TRANSFERENCIA',
    estado: 'PENDIENTE',
    createdAt: { gte: windowStart },
    monto: {
      gte: montoNum - tolerancia,
      lte: montoNum + tolerancia
    }
  };

  // Si tenemos ID del concepto, filtrar por ese pedido
  if (pedidoIdFromConcept) {
    const pagoEspecifico = await prisma.pago.findFirst({
      where: {
        ...pagosWhere,
        pedidoId: pedidoIdFromConcept
      },
      include: {
        pedido: {
          include: {
            pagos: true,
            items: { include: { producto: true } },
            mesa: true
          }
        }
      }
    });

    if (pagoEspecifico) {
      return [pagoEspecifico.pedido];
    }
  }

  // Buscar todos los pagos pendientes con monto coincidente
  const pagos = await prisma.pago.findMany({
    where: pagosWhere,
    include: {
      pedido: {
        include: {
          pagos: true,
          items: { include: { producto: true } },
          mesa: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Extraer pedidos únicos
  const pedidosMap = new Map();
  for (const pago of pagos) {
    if (!pedidosMap.has(pago.pedidoId)) {
      pedidosMap.set(pago.pedidoId, pago.pedido);
    }
  }

  return Array.from(pedidosMap.values());
}

/**
 * Algoritmo de matching automático
 * Busca pagos PENDIENTES de TRANSFERENCIA con monto coincidente
 * @param {object} transferencia - TransferenciaEntrante
 * @returns {Promise<{matched: boolean, pedidoId?: number, score: number, reason: string}>}
 */
async function autoMatchTransfer(transferencia) {
  const monto = parseFloat(transferencia.amount);
  const pedidoIdFromConcept = parseConceptForPedidoId(transferencia.concept);

  const candidatos = await findCandidatePedidos(monto, pedidoIdFromConcept);

  if (candidatos.length === 0) {
    return { matched: false, score: 0, reason: 'No se encontraron pagos pendientes con ese monto' };
  }

  // MATCH EXACTO: concepto + monto
  if (pedidoIdFromConcept) {
    const pedidoExacto = candidatos.find(p => p.id === pedidoIdFromConcept);
    if (pedidoExacto) {
      // Verificar que tiene un pago pendiente con el monto correcto
      const pagoPendiente = pedidoExacto.pagos.find(p =>
        p.metodo === 'TRANSFERENCIA' &&
        p.estado === 'PENDIENTE' &&
        Math.abs(parseFloat(p.monto) - monto) < 0.01
      );
      if (pagoPendiente) {
        return {
          matched: true,
          pedidoId: pedidoExacto.id,
          score: 1.0,
          reason: `Match exacto: concepto #${pedidoIdFromConcept} + monto $${monto}`
        };
      }
    }
  }

  // MATCH POR MONTO ÚNICO - solo si hay exactamente 1 pago pendiente con ese monto
  if (candidatos.length === 1) {
    const pedido = candidatos[0];
    const pagoPendiente = pedido.pagos.find(p =>
      p.metodo === 'TRANSFERENCIA' &&
      p.estado === 'PENDIENTE' &&
      Math.abs(parseFloat(p.monto) - monto) < 0.01
    );
    if (pagoPendiente) {
      return {
        matched: true,
        pedidoId: pedido.id,
        score: 0.8,
        reason: `Match por monto único: $${monto} → Pedido #${pedido.id}`
      };
    }
  }

  // MÚLTIPLES CANDIDATOS - No auto-matchear
  if (candidatos.length > 1) {
    return {
      matched: false,
      score: 0.5,
      reason: `${candidatos.length} pagos pendientes con monto $${monto} - requiere match manual`,
      candidatos: candidatos.map(p => p.id)
    };
  }

  return { matched: false, score: 0, reason: 'No se pudo determinar el pedido' };
}

/**
 * Procesa una transferencia entrante
 * @param {object} movementData - Datos del movimiento de MercadoPago
 * @returns {Promise<object>} - TransferenciaEntrante creada o actualizada
 */
async function processIncomingTransfer(movementData) {
  const mpMovementId = movementData.id?.toString();

  // Verificar si ya existe (idempotencia)
  const existente = await prisma.transferenciaEntrante.findUnique({
    where: { mpMovementId }
  });

  if (existente) {
    logger.info(`Transferencia ${mpMovementId} ya procesada`);
    return existente;
  }

  // Crear registro de transferencia
  const transferencia = await prisma.transferenciaEntrante.create({
    data: {
      mpMovementId,
      amount: parseFloat(movementData.amount || movementData.transaction_amount || 0),
      fee: movementData.fee ? parseFloat(movementData.fee) : null,
      netAmount: movementData.net_amount ? parseFloat(movementData.net_amount) : null,
      payerName: movementData.payer?.first_name
        ? `${movementData.payer.first_name} ${movementData.payer.last_name || ''}`.trim()
        : movementData.counterpart?.name || null,
      payerEmail: movementData.payer?.email || movementData.counterpart?.email || null,
      payerCuit: movementData.payer?.identification?.number || null,
      concept: movementData.description || movementData.concept || null,
      reference: movementData.external_reference || null,
      rawData: movementData
    }
  });

  logger.info(`Transferencia creada: ${mpMovementId}, monto: ${transferencia.amount}`);

  // Intentar match automático
  const matchResult = await autoMatchTransfer(transferencia);

  if (matchResult.matched && matchResult.pedidoId) {
    await executeMatch(transferencia.id, matchResult.pedidoId, matchResult.score, matchResult.reason);

    // Recargar con relaciones
    return prisma.transferenciaEntrante.findUnique({
      where: { id: transferencia.id },
      include: { pedido: true }
    });
  } else {
    // Guardar sugerencia de match
    await prisma.transferenciaEntrante.update({
      where: { id: transferencia.id },
      data: {
        matchScore: matchResult.score,
        matchReason: matchResult.reason
      }
    });

    // Emitir evento para notificar al admin
    eventBus.emit('transferencia.pendiente', {
      transferencia,
      matchResult
    });

    return transferencia;
  }
}

/**
 * Ejecuta el match entre transferencia y pedido
 * Busca el pago PENDIENTE existente y lo actualiza a APROBADO
 * @param {number} transferenciaId
 * @param {number} pedidoId
 * @param {number} score
 * @param {string} reason
 */
async function executeMatch(transferenciaId, pedidoId, score, reason) {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    const transferencia = await tx.transferenciaEntrante.findUnique({
      where: { id: transferenciaId }
    });

    // Buscar pago PENDIENTE de TRANSFERENCIA existente para este pedido
    let pago = pedido.pagos.find(p =>
      p.metodo === 'TRANSFERENCIA' &&
      p.estado === 'PENDIENTE'
    );

    if (pago) {
      // Actualizar pago existente a APROBADO
      pago = await tx.pago.update({
        where: { id: pago.id },
        data: {
          estado: 'APROBADO',
          referencia: `TRANSF-${transferencia.mpMovementId}`
        }
      });
    } else {
      // Si no hay pago pendiente, crear uno nuevo (para transferencias sin pago previo)
      pago = await tx.pago.create({
        data: {
          pedidoId,
          monto: transferencia.amount,
          metodo: 'TRANSFERENCIA',
          estado: 'APROBADO',
          referencia: `TRANSF-${transferencia.mpMovementId}`
        }
      });
    }

    // Actualizar transferencia
    await tx.transferenciaEntrante.update({
      where: { id: transferenciaId },
      data: {
        estado: 'MATCHED',
        pedidoId,
        pagoId: pago.id,
        matchScore: score,
        matchReason: reason,
        matchedAt: new Date()
      }
    });

    // Verificar si el pedido está completamente pagado
    const todosLosPagos = await tx.pago.findMany({
      where: { pedidoId, estado: 'APROBADO' }
    });
    const totalPagado = todosLosPagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
    const pedidoTotalmentePagedo = totalPagado >= parseFloat(pedido.total) - 0.01;

    // Actualizar pedido
    if (pedidoTotalmentePagedo) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: 'COBRADO',
          estadoPago: 'APROBADO'
        }
      });

      // Liberar mesa si aplica
      if (pedido.mesaId) {
        await tx.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'LIBRE' }
        });
      }
    } else {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estadoPago: 'APROBADO' }
      });
    }

    logger.info(`Match ejecutado: Transferencia ${transferenciaId} → Pedido ${pedidoId} (pagado: ${pedidoTotalmentePagedo})`);

    // Emitir evento
    eventBus.emit('pedido.updated', { pedidoId, estadoPago: 'APROBADO', estado: pedidoTotalmentePagedo ? 'COBRADO' : pedido.estado });
    eventBus.emit('transferencia.matched', { transferenciaId, pedidoId });

    return { transferencia, pago, pedido };
  });
}

/**
 * Match manual de transferencia a pedido
 * @param {number} transferenciaId
 * @param {number} pedidoId
 * @returns {Promise<object>}
 */
async function manualMatchTransfer(transferenciaId, pedidoId) {
  const transferencia = await prisma.transferenciaEntrante.findUnique({
    where: { id: transferenciaId }
  });

  if (!transferencia) {
    throw new Error('Transferencia no encontrada');
  }

  if (transferencia.estado !== 'PENDIENTE') {
    throw new Error(`Transferencia ya tiene estado: ${transferencia.estado}`);
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId }
  });

  if (!pedido) {
    throw new Error('Pedido no encontrado');
  }

  return executeMatch(transferenciaId, pedidoId, 1.0, 'Match manual por administrador');
}

/**
 * Rechaza/ignora una transferencia
 * @param {number} transferenciaId
 * @param {string} motivo
 * @returns {Promise<object>}
 */
async function rejectTransfer(transferenciaId, motivo = 'Rechazada manualmente') {
  return prisma.transferenciaEntrante.update({
    where: { id: transferenciaId },
    data: {
      estado: 'RECHAZADA',
      matchReason: motivo
    }
  });
}

/**
 * Lista transferencias con filtros
 * @param {object} options
 * @returns {Promise<object>}
 */
async function getTransferencias(options = {}) {
  const {
    estado = null,
    page = 1,
    limit = 20,
    desde = null,
    hasta = null
  } = options;

  const where = {};

  if (estado) {
    where.estado = estado;
  }

  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) where.createdAt.lte = new Date(hasta);
  }

  const [transferencias, total] = await Promise.all([
    prisma.transferenciaEntrante.findMany({
      where,
      include: {
        pedido: {
          select: {
            id: true,
            clienteNombre: true,
            total: true,
            estado: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.transferenciaEntrante.count({ where })
  ]);

  // Totales por estado
  const totales = await prisma.transferenciaEntrante.groupBy({
    by: ['estado'],
    _count: true,
    _sum: { amount: true }
  });

  return {
    transferencias,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    totales: totales.reduce((acc, t) => {
      acc[t.estado] = { count: t._count, monto: t._sum.amount || 0 };
      return acc;
    }, {})
  };
}

/**
 * Obtiene pedidos candidatos para match manual
 * @param {number} transferenciaId
 * @returns {Promise<Array>}
 */
async function getCandidatosParaMatch(transferenciaId) {
  const transferencia = await prisma.transferenciaEntrante.findUnique({
    where: { id: transferenciaId }
  });

  if (!transferencia) {
    throw new Error('Transferencia no encontrada');
  }

  const monto = parseFloat(transferencia.amount);
  const pedidoIdFromConcept = parseConceptForPedidoId(transferencia.concept);

  // Buscar pedidos pendientes de últimas 48h (más amplio para manual)
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - 48);

  const pedidos = await prisma.pedido.findMany({
    where: {
      estadoPago: 'PENDIENTE',
      createdAt: { gte: windowStart }
    },
    include: {
      items: { include: { producto: true } },
      pagos: true
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  // Calcular score de cada candidato
  return pedidos.map(pedido => {
    let score = 0;
    const reasons = [];

    // Coincidencia de monto
    const diffMonto = Math.abs(parseFloat(pedido.total) - monto);
    if (diffMonto < 0.01) {
      score += 0.5;
      reasons.push('Monto exacto');
    } else if (diffMonto < monto * 0.05) {
      score += 0.2;
      reasons.push('Monto similar (±5%)');
    }

    // Coincidencia de ID en concepto
    if (pedidoIdFromConcept && pedido.id === pedidoIdFromConcept) {
      score += 0.5;
      reasons.push('ID en concepto');
    }

    // Método de pago transferencia
    const pagoTransf = pedido.pagos.find(p => p.metodo === 'TRANSFERENCIA');
    if (pagoTransf) {
      score += 0.1;
      reasons.push('Esperando transferencia');
    }

    return {
      pedido,
      score,
      reasons
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Sincroniza transferencias desde MercadoPago (para polling)
 * @returns {Promise<{nuevas: number, procesadas: number}>}
 */
async function syncFromMercadoPago() {
  // Obtener última sincronización
  let syncInfo = await prisma.syncTransferencias.findUnique({
    where: { id: 1 }
  });

  if (!syncInfo) {
    // Primera sincronización - últimas 24 horas
    const desde = new Date();
    desde.setHours(desde.getHours() - 24);
    syncInfo = await prisma.syncTransferencias.create({
      data: { id: 1, lastSyncAt: desde }
    });
  }

  const desde = syncInfo.lastSyncAt;
  const hasta = new Date();

  logger.info(`Sincronizando transferencias desde ${desde.toISOString()}`);

  let movimientos;
  try {
    movimientos = await getAccountMovements(desde, hasta);
  } catch (error) {
    logger.error('Error al obtener movimientos:', error);
    return { nuevas: 0, procesadas: 0, error: error.message };
  }

  let nuevas = 0;
  let procesadas = 0;

  for (const mov of movimientos) {
    try {
      const result = await processIncomingTransfer(mov);
      procesadas++;
      if (result.estado === 'MATCHED' || result.estado === 'PENDIENTE') {
        nuevas++;
      }
    } catch (error) {
      logger.error(`Error procesando movimiento ${mov.id}:`, error);
    }
  }

  // Actualizar última sincronización
  await prisma.syncTransferencias.update({
    where: { id: 1 },
    data: { lastSyncAt: hasta }
  });

  logger.info(`Sync completado: ${nuevas} nuevas, ${procesadas} procesadas`);

  return { nuevas, procesadas };
}

/**
 * Obtiene datos bancarios para mostrar al cliente
 * @returns {Promise<object|null>}
 */
async function getDatosBancarios() {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 },
    select: {
      cvu: true,
      alias: true,
      cbuHolder: true,
      transferenciasEnabled: true
    }
  });

  if (!config || !config.transferenciasEnabled) {
    return null;
  }

  return {
    cvu: config.cvu,
    alias: config.alias,
    titular: config.cbuHolder,
    habilitado: config.transferenciasEnabled
  };
}

module.exports = {
  getAccountInfo,
  getAccountMovements,
  getMovementDetails,
  processIncomingTransfer,
  autoMatchTransfer,
  manualMatchTransfer,
  rejectTransfer,
  getTransferencias,
  getCandidatosParaMatch,
  syncFromMercadoPago,
  getDatosBancarios
};
