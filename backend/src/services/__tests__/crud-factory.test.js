const { createCrudService } = require('../crud-factory.service');
const { createHttpError } = require('../../utils/http-error');
const { prisma } = require('../../db/prisma');
const {
  uniqueId,
  createTenant,
  cleanupTenantData
} = require('../../__tests__/helpers/test-helpers');

describe('CRUD Factory Service', () => {
  let tenant;
  let testCrudService;

  beforeAll(async () => {
    tenant = await createTenant();
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await prisma.$disconnect();
  });

  describe('Configuración básica', () => {
    beforeAll(() => {
      // Usar modelo Mesa para tests (tiene soft delete con campo 'activa')
      testCrudService = createCrudService('mesa', {
        uniqueFields: { numero: 'número' },
        defaultOrderBy: { numero: 'asc' },
        softDelete: true,
        softDeleteField: 'activa',
        entityName: 'Mesa',
        gender: 'f'
      });
    });

    it('crea item correctamente', async () => {
      const numero = Math.floor(Math.random() * 1000) + 1;

      const result = await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 4
      });

      expect(result).toHaveProperty('id');
      expect(result.numero).toBe(numero);
      expect(result.capacidad).toBe(4);
      expect(result.tenantId).toBe(tenant.id);
    });

    it('rechaza crear item con campo único duplicado', async () => {
      const numero = Math.floor(Math.random() * 1000) + 1000;

      // Crear primera mesa
      await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 4
      });

      // Intentar crear segunda mesa con mismo número
      await expect(
        testCrudService.crear(prisma, {
          tenantId: tenant.id,
          numero,
          capacidad: 6
        })
      ).rejects.toThrow('Ya existe una Mesa con ese número');
    });

    it('lista items con filtros', async () => {
      const numero1 = Math.floor(Math.random() * 1000) + 2000;
      const numero2 = Math.floor(Math.random() * 1000) + 3000;

      await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero: numero1,
        capacidad: 4,
        activa: true
      });

      await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero: numero2,
        capacidad: 6,
        activa: false
      });

      const activas = await testCrudService.listar(prisma, { tenantId: tenant.id, activa: true });
      const mesaActiva = activas.find(m => m.numero === numero1);

      expect(mesaActiva).toBeDefined();
      expect(mesaActiva.activa).toBe(true);
    });

    it('obtiene item por ID', async () => {
      const numero = Math.floor(Math.random() * 1000) + 4000;

      const created = await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 4
      });

      const found = await testCrudService.obtener(prisma, created.id);

      expect(found.id).toBe(created.id);
      expect(found.numero).toBe(numero);
    });

    it('rechaza obtener item no existente', async () => {
      await expect(
        testCrudService.obtener(prisma, 999999)
      ).rejects.toThrow('Mesa no encontrada');
    });

    it('actualiza item correctamente', async () => {
      const numero = Math.floor(Math.random() * 1000) + 5000;

      const created = await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 4
      });

      const updated = await testCrudService.actualizar(prisma, created.id, {
        capacidad: 8
      });

      expect(updated.capacidad).toBe(8);
      expect(updated.numero).toBe(numero); // No cambió
    });

    it('rechaza actualizar item no existente', async () => {
      await expect(
        testCrudService.actualizar(prisma, 999999, { capacidad: 4 })
      ).rejects.toThrow('Mesa no encontrada');
    });

    it('rechaza actualizar con campo único duplicado', async () => {
      const numero1 = Math.floor(Math.random() * 1000) + 6000;
      const numero2 = Math.floor(Math.random() * 1000) + 7000;

      const mesa1 = await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero: numero1,
        capacidad: 4
      });

      const mesa2 = await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero: numero2,
        capacidad: 6
      });

      // Intentar cambiar numero de mesa2 al numero de mesa1
      await expect(
        testCrudService.actualizar(prisma, mesa2.id, { numero: numero1 })
      ).rejects.toThrow('Ya existe una Mesa con ese número');
    });

    it('soft delete marca campo activo como false', async () => {
      const numero = Math.floor(Math.random() * 1000) + 8000;

      const created = await testCrudService.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 4,
        activa: true
      });

      await testCrudService.eliminar(prisma, created.id);

      const deleted = await prisma.mesa.findUnique({
        where: { id: created.id }
      });

      expect(deleted).toBeDefined();
      expect(deleted.activa).toBe(false); // Soft delete
    });

    it('rechaza eliminar item no existente', async () => {
      await expect(
        testCrudService.eliminar(prisma, 999999)
      ).rejects.toThrow('Mesa no encontrada');
    });
  });

  describe('Hooks y validaciones personalizadas', () => {
    it('beforeCreate hook modifica data', async () => {
      const serviceWithHook = createCrudService('mesa', {
        entityName: 'Mesa',
        beforeCreate: async (prisma, data) => {
          // Hook que modifica la capacidad
          data.capacidad = (data.capacidad || 4) * 2;
          return data;
        }
      });

      const numero = Math.floor(Math.random() * 1000) + 9000;

      const result = await serviceWithHook.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 2
      });

      expect(result.capacidad).toBe(4); // 2 * 2
    });

    it('afterCreate hook se ejecuta', async () => {
      const mockAfterCreate = jest.fn();

      const serviceWithHook = createCrudService('mesa', {
        entityName: 'Mesa',
        afterCreate: mockAfterCreate
      });

      const numero = Math.floor(Math.random() * 1000) + 10000;

      await serviceWithHook.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 4
      });

      expect(mockAfterCreate).toHaveBeenCalled();
    });

    it('beforeUpdate hook modifica data', async () => {
      const serviceWithHook = createCrudService('mesa', {
        entityName: 'Mesa',
        beforeUpdate: async (prisma, id, data, existe) => {
          // Hook que fuerza capacidad mínima de 2
          if (data.capacidad && data.capacidad < 2) {
            data.capacidad = 2;
          }
          return data;
        }
      });

      const numero = Math.floor(Math.random() * 1000) + 11000;

      const created = await serviceWithHook.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 4
      });

      const updated = await serviceWithHook.actualizar(prisma, created.id, {
        capacidad: 1 // Menor a 2, debería forzarse a 2
      });

      expect(updated.capacidad).toBe(2);
    });

    it('customValidations.eliminar se ejecuta y puede rechazar', async () => {
      const serviceWithValidation = createCrudService('mesa', {
        entityName: 'Mesa',
        customValidations: {
          eliminar: async (prisma, id, item) => {
            // Validación: no eliminar mesas con capacidad > 4
            if (item.capacidad > 4) {
              throw createHttpError.badRequest(
                'No se puede eliminar: la mesa tiene capacidad mayor a 4'
              );
            }
          }
        }
      });

      const numero = Math.floor(Math.random() * 1000) + 12000;

      const created = await serviceWithValidation.crear(prisma, {
        tenantId: tenant.id,
        numero,
        capacidad: 6
      });

      await expect(
        serviceWithValidation.eliminar(prisma, created.id)
      ).rejects.toThrow('No se puede eliminar: la mesa tiene capacidad mayor a 4');
    });
  });

  describe('Hard delete (sin soft delete)', () => {
    it('hard delete elimina permanentemente', async () => {
      // Usar modelo Categoria que no tiene soft delete
      const categoriaService = createCrudService('categoria', {
        uniqueFields: { nombre: 'nombre' },
        defaultOrderBy: { orden: 'asc' },
        softDelete: false,
        entityName: 'categoría',
        gender: 'f'
      });

      const nombre = `Test Categoria ${uniqueId('cat')}`;

      const created = await categoriaService.crear(prisma, {
        tenantId: tenant.id,
        nombre,
        orden: 1,
        activa: true
      });

      await categoriaService.eliminar(prisma, created.id);

      const deleted = await prisma.categoria.findUnique({
        where: { id: created.id }
      });

      expect(deleted).toBeNull(); // Hard delete
    });
  });
});
