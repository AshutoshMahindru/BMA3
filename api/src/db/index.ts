import { Pool } from 'pg';

export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fpe_db',
  user: process.env.DB_USER || 'fpe_admin',
  password: process.env.DB_PASSWORD || 'fpe_password',
});
