const { publish, subscribe } = require('../services/event-bus');

describe('event-bus', () => {
  it('publica eventos y permite desuscribirse', () => {
    const handler = jest.fn();
    const unsubscribe = subscribe(handler);

    publish('pedido.updated', { id: 1 });
    expect(handler).toHaveBeenCalledWith({ type: 'pedido.updated', payload: { id: 1 } });

    handler.mockClear();
    unsubscribe();

    publish('pedido.updated', { id: 2 });
    expect(handler).not.toHaveBeenCalled();
  });
});
