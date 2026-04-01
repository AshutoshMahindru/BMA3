export interface MarketRow {
  name: string;
  city: string;
  status: string;
  launchQ: string;
  orders: string;
  revenue: string;
  margin: string;
  statusColor: string;
}

export interface GanttBar {
  kitchen: string;
  start: number;
  duration: number;
  color: string;
}

export interface RolloutPlanData {
  markets: MarketRow[];
  gantt: GanttBar[];
}

export const MARKETS_DATA: MarketRow[] = [
  { name: 'JLT North', city: 'Dubai', status: 'Live', launchQ: 'Q1 2024', orders: '4,350/mo', revenue: 'AED 270K', margin: '42%', statusColor: 'bg-green-100 text-green-700' },
  { name: 'Marina', city: 'Dubai', status: 'Live', launchQ: 'Q2 2024', orders: '3,800/mo', revenue: 'AED 232K', margin: '39%', statusColor: 'bg-green-100 text-green-700' },
  { name: 'Downtown', city: 'Dubai', status: 'Launching', launchQ: 'Q1 2025', orders: '— (projected)', revenue: 'AED 180K (F)', margin: '35% (F)', statusColor: 'bg-blue-100 text-blue-700' },
  { name: 'JBR', city: 'Dubai', status: 'Launching', launchQ: 'Q2 2025', orders: '— (projected)', revenue: 'AED 155K (F)', margin: '33% (F)', statusColor: 'bg-blue-100 text-blue-700' },
  { name: 'Business Bay', city: 'Dubai', status: 'Planned', launchQ: 'Q4 2025', orders: '—', revenue: 'AED 140K (F)', margin: '30% (F)', statusColor: 'bg-amber-100 text-amber-700' },
  { name: 'Al Reem Island', city: 'Abu Dhabi', status: 'Planned', launchQ: 'Q1 2026', orders: '—', revenue: 'AED 120K (F)', margin: '28% (F)', statusColor: 'bg-amber-100 text-amber-700' },
  { name: 'Al Nahda', city: 'Sharjah', status: 'Pipeline', launchQ: 'Q3 2026', orders: '—', revenue: 'TBD', margin: 'TBD', statusColor: 'bg-gray-100 text-gray-600' },
  { name: 'Al Ain Central', city: 'Al Ain', status: 'Pipeline', launchQ: 'Q1 2027', orders: '—', revenue: 'TBD', margin: 'TBD', statusColor: 'bg-gray-100 text-gray-600' },
];

export const GANTT_DATA: GanttBar[] = [
  { kitchen: 'JLT North', start: 0, duration: 12, color: '#1A7A4A' },
  { kitchen: 'Marina', start: 1, duration: 11, color: '#1A7A4A' },
  { kitchen: 'Downtown', start: 4, duration: 8, color: '#2563eb' },
  { kitchen: 'JBR', start: 5, duration: 7, color: '#2563eb' },
  { kitchen: 'Business Bay', start: 7, duration: 5, color: '#C47A1E' },
  { kitchen: 'Al Reem Island', start: 8, duration: 4, color: '#C47A1E' },
  { kitchen: 'Al Nahda', start: 10, duration: 2, color: '#94a3b8' },
  { kitchen: 'Al Ain Central', start: 12, duration: 0, color: '#94a3b8' },
];

export const ROLLOUT_FALLBACK: RolloutPlanData = {
  markets: MARKETS_DATA,
  gantt: GANTT_DATA
};

export const QUARTERS = ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26', 'Q4 26'];
