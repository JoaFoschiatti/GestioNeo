const { asyncHandler } = require('../utils/async-handler');

const flushPromises = () => new Promise(resolve => process.nextTick(resolve));

describe('asyncHandler', () => {
  it('ejecuta el handler y no llama next en exito', async () => {
    const handler = jest.fn().mockResolvedValue('ok');
    const next = jest.fn();

    asyncHandler(handler)({}, {}, next);
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('propaga errores sincronos a next', async () => {
    const error = new Error('boom');
    const handler = jest.fn(() => {
      throw error;
    });
    const next = jest.fn();

    asyncHandler(handler)({}, {}, next);
    await flushPromises();

    expect(next).toHaveBeenCalledWith(error);
  });

  it('propaga promesas rechazadas a next', async () => {
    const error = new Error('boom');
    const handler = jest.fn().mockRejectedValue(error);
    const next = jest.fn();

    asyncHandler(handler)({}, {}, next);
    await flushPromises();

    expect(next).toHaveBeenCalledWith(error);
  });
});
