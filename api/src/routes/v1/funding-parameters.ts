import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /funding-parameters
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    if (!scenario_id) {
      return res.status(400).json({ error: 'scenario_id is required' });
    }

    const equity = await db.query(
      'SELECT * FROM equity_rounds WHERE tenant_id = $1 AND scenario_id = $2',
      [tenant_id, scenario_id]
    );

    const debt = await db.query(
      'SELECT * FROM debt_facilities WHERE tenant_id = $1 AND scenario_id = $2',
      [tenant_id, scenario_id]
    );

    res.json({
      data: {
        equity_rounds: equity.rows,
        debt_facilities: debt.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /funding-parameters (Bulk Upsert via Delete-then-Insert)
router.post('/', async (req, res, next) => {
  const client = await db.connect();
  try {
    const { scenario_id, equity_rounds, debt_facilities } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    if (!scenario_id) {
      return res.status(400).json({ error: 'scenario_id is required' });
    }

    await client.query('BEGIN');

    // 1. Handle Equity Rounds
    if (Array.isArray(equity_rounds)) {
      // Clear existing for this scenario to ensure fresh state
      await client.query(
        'DELETE FROM equity_rounds WHERE tenant_id = $1 AND scenario_id = $2',
        [tenant_id, scenario_id]
      );
      
      for (const round of equity_rounds) {
        await client.query(
          `INSERT INTO equity_rounds (tenant_id, scenario_id, round_name, close_date, amount_raised, valuation_pre_money, lead_investor)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenant_id, scenario_id, round.round_name, round.close_date || new Date(), round.amount_raised || 0, round.valuation_pre_money, round.lead_investor]
        );
      }
    }

    // 2. Handle Debt Facilities
    if (Array.isArray(debt_facilities)) {
      await client.query(
        'DELETE FROM debt_facilities WHERE tenant_id = $1 AND scenario_id = $2',
        [tenant_id, scenario_id]
      );

      for (const facility of debt_facilities) {
        await client.query(
          `INSERT INTO debt_facilities (tenant_id, scenario_id, lender_name, principal_amount, interest_rate_annual, start_date, term_months, facility_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [tenant_id, scenario_id, facility.lender_name, facility.principal_amount || 0, facility.interest_rate_annual || 0, facility.start_date || new Date(), facility.term_months || 0, facility.facility_type || 'term_loan']
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ status: 'success', message: 'Funding parameters synchronized' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

export default router;
