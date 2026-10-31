import { builtinEnvironments } from 'vitest/environments';

/**
 * jsdom, but with Node's AbortController. jsdom replaces the global one, and Node's
 * fetch and Request reject its signals with a TypeError. Any fetch carrying a signal
 * then fails before it is sent, so abort behaviour could not be tested at all.
 */
export default {
  name: 'jsdom-native-abort',
  transformMode: 'web',
  async setup(global, options) {
    const { AbortController, AbortSignal } = global;
    const environment = await builtinEnvironments.jsdom.setup(global, options);
    global.AbortController = AbortController;
    global.AbortSignal = AbortSignal;
    return environment;
  },
};
