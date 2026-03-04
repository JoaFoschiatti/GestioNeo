const loadModule = () => {
  jest.resetModules();
  const basePrisma = { marker: 'base' };
  jest.doMock('../db/prisma', () => ({ prisma: basePrisma }));
  const { getPrisma } = require('../utils/get-prisma');
  return { getPrisma, basePrisma };
};

describe('getPrisma', () => {
  it('retorna prisma del request si existe', () => {
    const { getPrisma } = loadModule();
    const reqPrisma = { marker: 'req' };

    expect(getPrisma({ prisma: reqPrisma })).toBe(reqPrisma);
  });

  it('retorna prisma base si no hay prisma en request', () => {
    const { getPrisma, basePrisma } = loadModule();

    expect(getPrisma({})).toBe(basePrisma);
  });
});
