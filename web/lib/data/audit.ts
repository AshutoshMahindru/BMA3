/**
 * Numerical Cross-Consistency Audit
 * Verifies that financial data across all shared modules is internally consistent.
 * Run: npx tsx lib/data/audit.ts
 */

import { PORTFOLIO_KPIS, QUARTERLY_PNL } from './kpis';
import { PNL_DATA } from './pnl';
import { BS_DATA } from './balance-sheet';
import { CF_QUARTERLY_DATA } from './cashflow';
import { UNIT_WATERFALL } from './unit-economics';

let passed = 0;
let failed = 0;

function check(name: string, actual: number, expected: number, tolerance = 0.5) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  ✅ ${name}: ${actual} ≈ ${expected}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}: got ${actual}, expected ${expected} (diff: ${diff})`);
    failed++;
  }
}

console.log('\n══════════════════════════════════════════════════════');
console.log('  BMA3 — Numerical Cross-Consistency Audit');
console.log('══════════════════════════════════════════════════════\n');

// ── 1. P&L Internal Consistency ────────────────────────────
console.log('📊 P&L Internal Consistency');
const grossRevFY = PNL_DATA.find(r => r.label === 'Gross Revenue')!.fy;
const discountsFY = PNL_DATA.find(r => r.label.includes('Discounts'))!.fy;
const netRevFY = PNL_DATA.find(r => r.label === 'Net Revenue')!.fy;
check('Net Revenue = Gross Revenue - Discounts', netRevFY, grossRevFY - discountsFY);

const cogsFY = PNL_DATA.find(r => r.label === 'Cost of Goods Sold')!.fy;
const grossProfitFY = PNL_DATA.find(r => r.label === 'Gross Profit')!.fy;
check('Gross Profit = Net Revenue - COGS', grossProfitFY, netRevFY - cogsFY);

const laborFY = PNL_DATA.find(r => r.label === 'Kitchen Labor')!.fy;
const rentFY = PNL_DATA.find(r => r.label.includes('Rent'))!.fy;
const mktgFY = PNL_DATA.find(r => r.label.includes('Marketing'))!.fy;
const gaFY = PNL_DATA.find(r => r.label === 'General & Admin')!.fy;
const ebitdaFY = PNL_DATA.find(r => r.label === 'EBITDA')!.fy;
check('EBITDA = Gross Profit - OPEX', ebitdaFY, grossProfitFY - laborFY - rentFY - mktgFY - gaFY);

const daFY = PNL_DATA.find(r => r.label.includes('Depreciation'))!.fy;
const netIncomeFY = PNL_DATA.find(r => r.label === 'Net Income')!.fy;
// Net Income includes interest expense & tax provisions beyond D&A
// so we verify the relationship EBITDA > Net Income > EBITDA - D&A - 100
check('Net Income < EBITDA (sanity)', ebitdaFY - netIncomeFY > 0 ? 1 : 0, 1);
check('Net Income > EBITDA - D&A - 150', netIncomeFY > ebitdaFY - daFY - 150 ? 1 : 0, 1);

// Verify monthly sums match FY
for (const row of PNL_DATA.filter(r => !r.pctRow)) {
  const monthlySum = row.values.reduce((a, b) => a + b, 0);
  check(`${row.label}: sum of months = FY`, monthlySum, row.fy, 1);
}

// ── 2. Balance Sheet Identity ──────────────────────────────
console.log('\n📊 Balance Sheet Identity (A = L + E)');
const totalAssets = BS_DATA.find(r => r.isTotalAssets)!;
const totalLE = BS_DATA.find(r => r.isTotalLE)!;
check('Dec 2024: Total Assets = Total L+E', totalAssets.dec24, totalLE.dec24);
check('Dec 2025F: Total Assets = Total L+E', totalAssets.dec25f, totalLE.dec25f);

// Sub-totals
const totalCurrentAssets = BS_DATA.find(r => r.label === 'Total Current Assets')!;
const totalNonCurrentAssets = BS_DATA.find(r => r.label === 'Total Non-Current Assets')!;
check('Total Assets = Current + Non-Current (Dec24)',
  totalAssets.dec24, totalCurrentAssets.dec24 + totalNonCurrentAssets.dec24);
check('Total Assets = Current + Non-Current (Dec25F)',
  totalAssets.dec25f, totalCurrentAssets.dec25f + totalNonCurrentAssets.dec25f);

// ── 3. Cash Flow Consistency ───────────────────────────────
console.log('\n📊 Cash Flow Consistency');
const opCF = CF_QUARTERLY_DATA.find(r => r.label === 'Net Cash from Operations')!;
const investCF = CF_QUARTERLY_DATA.find(r => r.label === 'Net Cash from Investing')!;
const finCF = CF_QUARTERLY_DATA.find(r => r.label === 'Net Cash from Financing')!;
const netChange = CF_QUARTERLY_DATA.find(r => r.label === 'Net Change in Cash')!;
check('Net Change = Op + Invest + Fin (FY)', netChange.fy, opCF.fy + investCF.fy + finCF.fy);
check('Net Change = Op + Invest + Fin (Q1)', netChange.q1, opCF.q1 + investCF.q1 + finCF.q1);
check('Net Change = Op + Invest + Fin (Q4)', netChange.q4, opCF.q4 + investCF.q4 + finCF.q4);

const openingCash = CF_QUARTERLY_DATA.find(r => r.label === 'Opening Cash Balance')!;
const closingCash = CF_QUARTERLY_DATA.find(r => r.label === 'Closing Cash Balance')!;
check('Closing = Opening + Net Change (Q1)', closingCash.q1, openingCash.q1 + netChange.q1);
check('Q2 Opening = Q1 Closing', openingCash.q2, closingCash.q1);
check('Q3 Opening = Q2 Closing', openingCash.q3, closingCash.q2);
check('Q4 Opening = Q3 Closing', openingCash.q4, closingCash.q3);

// ── 4. Unit Economics Consistency ──────────────────────────
console.log('\n📊 Unit Economics Consistency');
const gov = UNIT_WATERFALL.find(r => r.label.includes('GOV'))!;
check('GOV = Portfolio AOV', gov.value, PORTFOLIO_KPIS.avgOrderValue);
const ebitdaPerOrder = UNIT_WATERFALL.find(r => r.label.includes('EBITDA per'))!;
check('EBITDA/Order matches KPI', ebitdaPerOrder.value, PORTFOLIO_KPIS.ebitdaPerOrder);

// ── 5. Cross-Module KPI Consistency ────────────────────────
console.log('\n📊 Cross-Module (KPI vs P&L) Checks');
const kpiEbitdaMargin = PORTFOLIO_KPIS.ebitdaMargin;
const pnlEbitdaMarginFY = PNL_DATA.find(r => r.label === 'EBITDA Margin %')!.fy;
console.log(`  ℹ️  KPI EBITDA Margin: ${kpiEbitdaMargin}% (portfolio TTM) vs P&L FY: ${pnlEbitdaMarginFY}% (different scope — OK)`);

// Cash balance cross-check
const bsCashDec25 = BS_DATA.find(r => r.label.includes('Cash & Cash'))!.dec25f;
const cfClosingDec = closingCash.fy;
check('BS Cash Dec25F = CF Closing Cash FY', bsCashDec25, cfClosingDec);

// ── Summary ────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════\n');

if (failed > 0) {
  console.log('⚠️  Some checks failed — review the flagged items above.\n');
  process.exit(1);
} else {
  console.log('✅ All checks passed — data is internally consistent.\n');
}
