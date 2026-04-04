import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './lib/logger';

// ── SpecOS-aligned routes (canonical namespace) ──
import contextRouter from './routes/v1/context';
import assumptionsRouter from './routes/v1/assumptions';
import financialsRouter from './routes/v1/financials';
import computeRouter from './routes/v1/compute';
import analysisRouter from './routes/v1/analysis';
import scopeRouter from './routes/v1/scope';
import decisionsRouter from './routes/v1/decisions';
import confidenceRouter from './routes/v1/confidence';
import governanceRouter from './routes/v1/governance';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════════════════════════════════════════
// SpecOS-aligned routes — all endpoints from api_contracts.json
// ════════════════════════════════════════════════════════════════════════════════
app.use('/api/v1/context', contextRouter);
app.use('/api/v1/assumptions', assumptionsRouter);
app.use('/api/v1/financials', financialsRouter);
app.use('/api/v1/compute', computeRouter);
app.use('/api/v1/analysis', analysisRouter);
app.use('/api/v1/scope', scopeRouter);
app.use('/api/v1/decisions', decisionsRouter);
app.use('/api/v1/confidence', confidenceRouter);
app.use('/api/v1/governance', governanceRouter);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'OK', message: 'BMA3 API is running', version: '2.0' });
});

// Standard Error Envelope
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const traceIdHeader = req.headers['x-trace-id'];
  const requestIdHeader = req.headers['x-request-id'];
  const traceId = Array.isArray(traceIdHeader) ? traceIdHeader[0] : traceIdHeader;
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

  logger.error(
    {
      err,
      stack: err?.stack,
      method: req.method,
      url: req.originalUrl || req.url,
      requestId,
      traceId,
    },
    'Unhandled API error'
  );

  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      trace_id: req.headers['x-trace-id'] || 'no-trace-id'
    }
  });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'BMA3 API Server running');
});
