import { beforeEach, describe, test } from '@std/testing/bdd';
import { TypedEvents } from './typed_events.ts';
import { assertSpyCall, assertSpyCalls, spy } from '@std/testing/mock';
import { assertThrows } from '@std/assert/throws';

type EventMap = {
  test: (data: unknown) => void;
};

describe('TypedEvents', () => {
  let typedEvents: TypedEvents<EventMap>;

  beforeEach(() => {
    typedEvents = new TypedEvents<EventMap>(5);
  });

  describe('#on', () => {
    test('callback should be called', () => {
      const callback = spy();
      typedEvents.on('test', callback);
      typedEvents.emit('test', 'foo');
      assertSpyCall(callback, 0, { args: ['foo'] });
    });
    test('callback should be called multiple times', () => {
      const callback = spy();
      typedEvents.on('test', callback);
      typedEvents.emit('test', 'foo');
      typedEvents.emit('test', 'bar');
      typedEvents.emit('test', 'baz');
      assertSpyCall(callback, 0, { args: ['foo'] });
      assertSpyCall(callback, 1, { args: ['bar'] });
      assertSpyCall(callback, 2, { args: ['baz'] });
    });
    test('callback should be called while susbcribed but not after dispose is called', () => {
      const callback = spy();
      const dispose = typedEvents.on('test', callback);
      typedEvents.emit('test', 'foo');
      dispose();
      typedEvents.emit('test', 'bar');
      typedEvents.emit('test', 'baz');
      assertSpyCalls(callback, 1);
    });

    test('should throw an error when maxListeners is reached', () => {
      const callback = spy();
      typedEvents.on('test', callback);
      typedEvents.on('test', callback);
      typedEvents.on('test', callback);
      typedEvents.on('test', callback);
      typedEvents.on('test', callback);
      assertThrows(
        () => typedEvents.on('test', callback),
        'Max listeners reached ',
      );
    });
  });

  describe('#once', () => {
    test('callback should be called once', () => {
      const callback = spy();
      typedEvents.once('test', callback);
      typedEvents.emit('test', 'foo');
      typedEvents.emit('test', 'bar');
      assertSpyCalls(callback, 1);
    });
    test('callback should not be called after dispose fn is called', () => {
      const callback = spy();
      const dispose = typedEvents.once('test', callback);
      dispose();
      typedEvents.emit('test', 'foo');
      assertSpyCalls(callback, 0);
    });
  });

  describe('#off', () => {
    test('callback should be called while susbcribed but not after off method is called', () => {
      const callback = spy();
      typedEvents.on('test', callback);
      typedEvents.once('test', callback);
      typedEvents.emit('test', 'foo');
      typedEvents.off('test', callback);
      typedEvents.emit('test', 'bar');
      typedEvents.emit('test', 'baz');
      assertSpyCalls(callback, 2);
    });
  });

  describe('#removeAllListeners', () => {
    test('callback should not be called after removeAllListeners is called', () => {
      const callback = spy();
      typedEvents.on('test', callback);
      typedEvents.on('test', callback);
      typedEvents.removeAllListeners('test');
      typedEvents.emit('test', 'foo');
      assertSpyCalls(callback, 0);
    });
    test('callback should not be called after removeAllListeners is called but eventName is not given', () => {
      const callback = spy();
      typedEvents.on('test', callback);
      typedEvents.on('test', callback);
      typedEvents.removeAllListeners();
      typedEvents.emit('test', 'foo');
      assertSpyCalls(callback, 0);
    });
  });
});
