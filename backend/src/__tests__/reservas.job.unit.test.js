const mockPublish = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn() };

const mockPrisma = {
  reserva: {
    findMany: jest.fn(),
    update: jest.fn()
  },
  mesa: {
    update: jest.fn()
  }
};

jest.mock('../services/event-bus', () => ({
  publish: (...args) => mockPublish(...args)
}));

jest.mock('../utils/logger', () => ({
  logger: mockLogger
}));

jest.mock('../db/prisma', () => ({
  prisma: mockPrisma
}));

const { procesarReservas } = require('../jobs/reservas.job');

describe('reservas.job (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marca mesas reservadas y reservas vencidas', async () => {
    const reservasProximas = [
      {
        id: 1,
        tenantId: 10,
        mesaId: 5,
        mesa: { estado: 'LIBRE', numero: 1 }
      }
    ];

    const reservasVencidas = [
      {
        id: 2,
        tenantId: 10,
        mesaId: 6,
        mesa: { estado: 'RESERVADA' }
      }
    ];

    mockPrisma.reserva.findMany
      .mockResolvedValueOnce(reservasProximas)
      .mockResolvedValueOnce(reservasVencidas);

    await procesarReservas();

    expect(mockPrisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { estado: 'RESERVADA' }
    });

    expect(mockPrisma.reserva.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { estado: 'NO_LLEGO' }
    });

    expect(mockPrisma.mesa.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { estado: 'LIBRE' }
    });

    expect(mockPublish).toHaveBeenCalledWith('mesa.updated', expect.objectContaining({ mesaId: 5 }));
    expect(mockPublish).toHaveBeenCalledWith('mesa.updated', expect.objectContaining({ mesaId: 6 }));
    expect(mockPublish).toHaveBeenCalledWith('reserva.updated', expect.objectContaining({ id: 2 }));
  });

  it('no actualiza mesa si ya esta reservada', async () => {
    mockPrisma.reserva.findMany
      .mockResolvedValueOnce([
        { id: 1, tenantId: 10, mesaId: 5, mesa: { estado: 'RESERVADA' } }
      ])
      .mockResolvedValueOnce([]);

    await procesarReservas();

    expect(mockPrisma.mesa.update).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
