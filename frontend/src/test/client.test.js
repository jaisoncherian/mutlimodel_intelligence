import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { client, normalizeError } from '../api/client.js';
import error400Fixture from './fixtures/error_400.json';
import error404Fixture from './fixtures/error_404.json';
import error503Fixture from './fixtures/error_503.json';

const server = setupServer(
  http.get('/api/test-400', () => {
    return HttpResponse.json(error400Fixture, { status: 400 });
  }),
  http.get('/api/test-404', () => {
    return HttpResponse.json(error404Fixture, { status: 404 });
  }),
  http.get('/api/test-503', () => {
    return HttpResponse.json(error503Fixture, { status: 503 });
  }),
  http.get('/api/test-network-error', () => {
    return HttpResponse.error();
  }),
  http.get('/api/test-delayed', async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return HttpResponse.json({ ok: true });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API Client error mapping with real fixtures', () => {
  it('maps 400 Bad Request to normalized error shape { status, message }', async () => {
    try {
      await client.get('/test-400');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toEqual({
        status: 400,
        message: error400Fixture.error,
      });
    }
  });

  it('maps 404 Not Found to normalized error shape { status, message }', async () => {
    try {
      await client.get('/test-404');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toEqual({
        status: 404,
        message: error404Fixture.error,
      });
    }
  });

  it('maps 503 Service Unavailable to normalized error shape { status, message }', async () => {
    try {
      await client.get('/test-503');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toEqual({
        status: 503,
        message: error503Fixture.error,
      });
    }
  });

  it('maps network failures to status 0 and a helpful message', async () => {
    try {
      await client.get('/test-network-error');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err.status).toBe(0);
      expect(err.message).toMatch(/network/i);
    }
  });

  it('handles request abort gracefully with AbortController', async () => {
    const controller = new globalThis.AbortController();
    setTimeout(() => controller.abort(), 10);

    try {
      await client.get('/test-delayed', { signal: controller.signal });
      expect.fail('Should have thrown an abort error');
    } catch (err) {
      expect(err.status).toBe(0);
      expect(err.message).toMatch(/cancelled/i);
    }
  });

  it('normalizeError formats unknown objects into valid { status, message }', () => {
    const custom = normalizeError(new Error('Boom'), 500);
    expect(custom).toEqual({ status: 500, message: 'Boom' });

    const alreadyNormalized = normalizeError({ status: 422, message: 'Invalid field' });
    expect(alreadyNormalized).toEqual({ status: 422, message: 'Invalid field' });
  });
});
