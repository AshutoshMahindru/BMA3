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

  it('serves canonical reference routes with authenticated company context', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: '10000000-0000-4000-8000-000000000111',
            tenant_id: '10000000-0000-4000-8000-000000000001',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            node_id: '20000000-0000-4000-8000-000000000111',
            parent_node_id: null,
            label: 'Dark Kitchen',
            code: 'DK',
            level: 0,
          },
        ],
      });

    const response = await fetch(
      `${baseUrl}/api/v1/reference/formats?companyId=10000000-0000-4000-8000-000000000111&limit=1`,
      {
        headers: {
          Authorization: 'Bearer dev-local-token',
        },
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([
      {
        nodeId: '20000000-0000-4000-8000-000000000111',
        name: 'Dark Kitchen',
        parentId: null,
        level: 0,
      },
    ]);
    expect(payload.meta?.companyId).toBe('10000000-0000-4000-8000-000000000111');
  });

  it('serves the AI advisory router on authenticated requests', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: '10000000-0000-4000-8000-000000000111',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: '90000000-0000-4000-8000-000000000111',
            variable_name: 'take_rate',
            current_value: 0.24,
            unit: 'ratio',
            evidence_ref: 'survey',
            family: 'demand',
            pack_name: 'Demand Pack',
          },
        ],
      });

    const response = await fetch(`${baseUrl}/api/v1/ai/edit-suggestions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dev-local-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          companyId: '10000000-0000-4000-8000-000000000111',
          surface: 'assumptions',
        },
        prompt: 'Increase demand confidence for the current quarter',
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data?.draftOnly).toBe(true);
    expect(payload.data?.suggestions?.[0]).toMatchObject({
      fieldId: '90000000-0000-4000-8000-000000000111',
      currentValue: 0.24,
      confidence: 'medium',
    });
    expect(payload.meta?.advisoryOnly).toBe(true);
  });
});
