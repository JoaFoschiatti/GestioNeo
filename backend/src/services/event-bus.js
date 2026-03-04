const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

const publish = (type, payload) => {
  emitter.emit('event', { type, payload });
};

const subscribe = (handler) => {
  emitter.on('event', handler);
  return () => emitter.off('event', handler);
};

module.exports = {
  publish,
  subscribe
};
