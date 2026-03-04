const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('mesa', {
  uniqueFields: { numero: 'número' },
  defaultOrderBy: { numero: 'asc' },
  defaultInclude: {
    pedidos: {
      where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
      take: 1
    }
  },
  softDelete: true,
  softDeleteField: 'activa',
  entityName: 'mesa',
  gender: 'f',

  // Protección mass assignment
  allowedFilterFields: ['activa', 'estado', 'capacidad', 'grupoMesaId'],
  allowedCreateFields: ['numero', 'capacidad', 'activa', 'zona'],
  allowedUpdateFields: ['capacidad', 'activa', 'estado', 'zona', 'posX', 'posY', 'rotacion', 'grupoMesaId']
});

// Sobrescribir obtener para usar include más detallado
const obtener = async (prisma, id) => {
  const mesa = await prisma.mesa.findUnique({
    where: { id },
    include: {
      pedidos: {
        where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
        include: { items: { include: { producto: true } } }
      }
    }
  });

  if (!mesa) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  return mesa;
};

// Función específica: cambiar estado de la mesa
const cambiarEstado = async (prisma, id, estado) => {
  const mesaExiste = await prisma.mesa.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!mesaExiste) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  return prisma.mesa.update({
    where: { id },
    data: { estado }
  });
};

// Actualizar posiciones de múltiples mesas en batch (transacción)
const actualizarPosiciones = async (prisma, posiciones) => {
  return prisma.$transaction(
    posiciones.map(({ id, zona, posX, posY, rotacion }) =>
      prisma.mesa.update({
        where: { id },
        data: { zona, posX, posY, ...(rotacion !== undefined && { rotacion }) }
      })
    )
  );
};

// Agrupar mesas: asigna el mismo grupoMesaId a varias mesas
const agruparMesas = async (prisma, mesaIds) => {
  return prisma.$transaction(async (tx) => {
    const mesas = await tx.mesa.findMany({
      where: { id: { in: mesaIds } }
    });

    if (mesas.length !== mesaIds.length) {
      throw createHttpError.badRequest('Una o más mesas no existen');
    }

    const estadosInvalidos = mesas.filter(m => !['LIBRE', 'OCUPADA'].includes(m.estado));
    if (estadosInvalidos.length > 0) {
      throw createHttpError.badRequest('Todas las mesas deben estar LIBRE u OCUPADA para agrupar');
    }

    const yaAgrupadas = mesas.filter(m => m.grupoMesaId != null);
    if (yaAgrupadas.length > 0) {
      throw createHttpError.badRequest(`Mesa(s) ${yaAgrupadas.map(m => m.numero).join(', ')} ya están en un grupo`);
    }

    // La mesa principal es la de número más bajo
    const mesaPrincipal = mesas.reduce((min, m) => m.numero < min.numero ? m : min, mesas[0]);
    const grupoMesaId = mesaPrincipal.id;

    await tx.mesa.updateMany({
      where: { id: { in: mesaIds } },
      data: { grupoMesaId }
    });

    return tx.mesa.findMany({
      where: { id: { in: mesaIds } },
      orderBy: { numero: 'asc' }
    });
  });
};

// Desagrupar mesas: quitar grupoMesaId de todas las mesas del grupo
const desagruparMesas = async (prisma, grupoMesaId) => {
  return prisma.$transaction(async (tx) => {
    const mesasGrupo = await tx.mesa.findMany({
      where: { grupoMesaId },
      include: {
        pedidos: {
          where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } }
        }
      }
    });

    if (mesasGrupo.length === 0) {
      throw createHttpError.notFound('Grupo de mesas no encontrado');
    }

    const conPedidosActivos = mesasGrupo.some(m => m.pedidos.length > 0);
    if (conPedidosActivos) {
      throw createHttpError.badRequest('No se puede desagrupar mientras haya pedidos activos en el grupo');
    }

    await tx.mesa.updateMany({
      where: { grupoMesaId },
      data: { grupoMesaId: null }
    });

    return { message: 'Mesas desagrupadas correctamente' };
  });
};

// Pedir cuenta: mozo solicita la cuenta para una mesa ocupada
const pedirCuenta = async (prisma, id) => {
  const mesa = await prisma.mesa.findUnique({
    where: { id },
    include: {
      pedidos: {
        where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
        include: { items: { include: { producto: true } }, pagos: true }
      }
    }
  });

  if (!mesa) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  if (mesa.estado !== 'OCUPADA') {
    throw createHttpError.badRequest('Solo se puede pedir la cuenta de una mesa ocupada');
  }

  if (mesa.pedidos.length === 0) {
    throw createHttpError.badRequest('La mesa no tiene pedidos activos');
  }

  // Si la mesa está en un grupo, cambiar TODAS las del grupo a CUENTA_PEDIDA
  if (mesa.grupoMesaId) {
    await prisma.mesa.updateMany({
      where: { grupoMesaId: mesa.grupoMesaId, estado: 'OCUPADA' },
      data: { estado: 'CUENTA_PEDIDA' }
    });
  }

  const mesaActualizada = await prisma.mesa.update({
    where: { id },
    data: { estado: 'CUENTA_PEDIDA' },
    include: {
      pedidos: {
        where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
        include: { items: { include: { producto: true } }, pagos: true }
      }
    }
  });

  return mesaActualizada;
};

module.exports = {
  ...baseCrud,
  obtener, // Sobrescribir con versión custom
  cambiarEstado,
  actualizarPosiciones,
  pedirCuenta,
  agruparMesas,
  desagruparMesas
};

