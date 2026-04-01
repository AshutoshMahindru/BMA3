import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import companiesRouter from './routes/v1/companies';
import planningCalendarsRouter from './routes/v1/planning-calendars';
import scenariosRouter from './routes/v1/scenarios';
import demandDriversRouter from './routes/v1/demand-drivers';
import pricePlansRouter from './routes/v1/price-plans';
import mixPlansRouter from './routes/v1/mix-plans';
import unitCostProfilesRouter from './routes/v1/unit-cost-profiles';
import laborModelsRouter from './routes/v1/labor-models';
import opexPlansRouter from './routes/v1/opex-plans';
import marketingPlansRouter from './routes/v1/marketing-plans';
import capexPlansRouter from './routes/v1/capex-plans';
import workingCapitalPoliciesRouter from './routes/v1/working-capital-policies';
import financialProjectionsRouter from './routes/v1/financial-projections';
import unitEconomicsRouter from './routes/v1/unit-economics';
import kpiProjectionsRouter from './routes/v1/kpi-projections';
import driverExplainabilityRouter from './routes/v1/driver-explainability';
import fundingParametersRouter from './routes/v1/funding-parameters';
import rolloutPlansRouter from './routes/v1/rollout-plans';
import riskScenariosRouter from './routes/v1/risk-scenarios';
import simulationRunsRouter from './routes/v1/simulation-runs';
// import './jobs'; // Boot BullMQ worker

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Phase 1 Routes
app.use('/api/v1/companies', companiesRouter);
app.use('/api/v1/planning-calendars', planningCalendarsRouter);
app.use('/api/v1/scenarios', scenariosRouter);

// Phase 2 Routes (Sprint 2.1 & 2.2)
app.use('/api/v1/demand-drivers', demandDriversRouter);
app.use('/api/v1/price-plans', pricePlansRouter);
app.use('/api/v1/mix-plans', mixPlansRouter);
app.use('/api/v1/unit-cost-profiles', unitCostProfilesRouter);
app.use('/api/v1/labor-models', laborModelsRouter);

// Phase 2 Routes (Sprint 2.3 & 2.4)
app.use('/api/v1/opex-plans', opexPlansRouter);
app.use('/api/v1/marketing-plans', marketingPlansRouter);
app.use('/api/v1/capex-plans', capexPlansRouter);
app.use('/api/v1/working-capital-policies', workingCapitalPoliciesRouter);

// Phase 2 Routes (Sprint 2.5 & 2.6)
app.use('/api/v1/financial-projections', financialProjectionsRouter);
app.use('/api/v1/unit-economics', unitEconomicsRouter);
app.use('/api/v1/kpi-projections', kpiProjectionsRouter);

// Phase 3 Routes (Sprint 3.2)
app.use('/api/v1/driver-explainability', driverExplainabilityRouter);
app.use('/api/v1/funding-parameters', fundingParametersRouter);
app.use('/api/v1/rollout-plans', rolloutPlansRouter);

// Phase 4 Routes (Sprint 4.1-4.4)
app.use('/api/v1/risk-scenarios', riskScenariosRouter);
app.use('/api/v1/simulation-runs', simulationRunsRouter);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', message: 'FPE API is running' });
});

// Standard Error Envelope response
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  console.log(`FPE API Server running on port ${PORT}`);
});
