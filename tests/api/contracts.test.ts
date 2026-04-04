import type { Server } from 'http';

jest.mock('../../api/src/db', () => ({
  db: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { app } from '../../api/src/server';
import { db } from '../../api/src/db';

const mockedQuery = db.query as jest.Mock;

describe('API contracts', () => {
  let server: Server;
  let baseUrl = '';

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('keeps health public', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'OK',
      message: 'BMA3 API is running',
    });
  });

  it('rejects missing bearer tokens on protected endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/v1/context/companies`);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'User not authenticated',
    });
  });

  it('returns the canonical envelope for authenticated routes', async () => {
    mockedQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: '10000000-0000-4000-8000-000000000111',
          name: 'Acme Kitchens',
          created_at: '2026-04-04T00:00:00.000Z',
        },
      ],
    });

    const response = await fetch(`${baseUrl}/api/v1/context/companies?limit=1`, {
      headers: {
        Authorization: 'Bearer dev-local-token',
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([
      {
        companyId: '10000000-0000-4000-8000-000000000111',
        name: 'Acme Kitchens',
        status: 'active',
        createdAt: '2026-04-04T00:00:00.000Z',
      },
    ]);
    expect(payload.meta?.freshness?.source).toBe('database');
  });
});
