const listarAnulaciones = async (prisma, query) => {
  const { fechaDesde, fechaHasta, tipo, usuarioId, limit = 50 } = query;

  const where = {};

  if (tipo) {
    where.tipo = tipo;
  }

  if (usuarioId) {
    where.usuarioId = Number(usuarioId);
  }

  if (fechaDesde) {
    where.createdAt = { ...where.createdAt, gte: new Date(`${fechaDesde}T00:00:00`) };
  }
  if (fechaHasta) {
    const end = new Date(`${fechaHasta}T00:00:00`);
    end.setDate(end.getDate() + 1);
    where.createdAt = { ...where.createdAt, lt: end };
  }

  return prisma.auditoriaAnulacion.findMany({
    where,
    include: {
      usuario: { select: { nombre: true, email: true } },
      pedido: { select: { id: true, tipo: true, total: true, mesaId: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit)
  });
};

module.exports = {
  listarAnulaciones
};
