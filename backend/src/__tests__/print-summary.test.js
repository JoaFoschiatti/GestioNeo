const { getLatestPrintSummary } = require('../services/print.service');

describe('getLatestPrintSummary', () => {
  it('retorna null cuando no hay jobs', () => {
    expect(getLatestPrintSummary([])).toBeNull();
  });

  it('resume el ultimo batch con estado pendiente', () => {
    const jobs = [
      { batchId: 'A', status: 'OK', createdAt: '2024-01-01T10:00:00Z' },
      { batchId: 'A', status: 'ERROR', createdAt: '2024-01-01T11:00:00Z', lastError: 'Jam' },
      { batchId: 'B', status: 'OK', createdAt: '2024-02-01T10:00:00Z' },
      { batchId: 'B', status: 'PENDIENTE', createdAt: '2024-02-02T10:00:00Z' }
    ];

    const summary = getLatestPrintSummary(jobs);

    expect(summary).toEqual({
      batchId: 'B',
      total: 2,
      ok: 1,
      error: 0,
      pending: 1,
      status: 'PENDIENTE',
      lastError: null
    });
  });

  it('marca error si algun job falla en el ultimo batch', () => {
    const jobs = [
      { batchId: 'A', status: 'OK', createdAt: '2024-01-01T10:00:00Z' },
      { batchId: 'B', status: 'ERROR', createdAt: '2024-02-02T10:00:00Z', lastError: 'Paper' },
      { batchId: 'B', status: 'OK', createdAt: '2024-02-02T09:00:00Z' }
    ];

    const summary = getLatestPrintSummary(jobs);

    expect(summary.status).toBe('ERROR');
    expect(summary.error).toBe(1);
    expect(summary.lastError).toBe('Paper');
  });
});
