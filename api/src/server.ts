import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// ── BullMQ worker — must be imported before routes so the worker process starts ──
import './jobs';

// ── SpecOS-aligned routes (canonical namespace) ──
import contextRouter from './routes/v1/context';
import assumptionsRouter from './routes/v1/assumptions';
import financialsRouter from './routes/v1/financials';
import computeRouter from './routes/v1/compute';

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

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'OK', message: 'BMA3 API is running', version: '2.0' });
});

// Standard Error Envelope
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      trace_id: req.headers['x-trace-id'] || 'no-trace-id'
    }
  });
});

app.listen(PORT, () => {
  console.log(`BMA3 API Server running on port ${PORT}`);
});
